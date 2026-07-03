import { Router } from "express";
import type { Keypair } from "@stellar/stellar-sdk";
import { prisma } from "../db.js";
import { WorkflowSchema } from "../workflow.js";
import { executeWorkflow } from "../engine/executor.js";
import type { RunLogEvent } from "../engine/types.js";

export const runsRouter = Router();

/**
 * Ephemeral per-run signers (vault wallet secrets), held in memory only between
 * the POST that creates a run and the SSE stream that executes it. Never
 * written to the database. Cleared on consume, with a TTL sweep as a backstop.
 */
const pendingSigners = new Map<
  string,
  { signers?: Record<string, string>; nodeSecrets?: Record<string, string>; at: number }
>();
const SIGNER_TTL_MS = 5 * 60_000;
function sweepSigners() {
  const now = Date.now();
  for (const [id, v] of pendingSigners) if (now - v.at > SIGNER_TTL_MS) pendingSigners.delete(id);
}

/** Create a run from a workflow. Returns { runId } to stream. */
runsRouter.post("/", async (req, res) => {
  const parsed = WorkflowSchema.safeParse(req.body?.workflow);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid workflow.", details: parsed.error.flatten() });
  }
  const wf = parsed.data;
  const run = await prisma.run.create({
    data: {
      network: "testnet",
      workflow: JSON.stringify(wf),
      status: "pending",
      projectId: typeof req.body?.projectId === "string" ? req.body.projectId : undefined,
    },
  });

  // Stash any provided secrets in memory (not persisted).
  const signers = req.body?.signers;
  const nodeSecrets = req.body?.nodeSecrets;
  if ((signers && typeof signers === "object") || (nodeSecrets && typeof nodeSecrets === "object")) {
    sweepSigners();
    pendingSigners.set(run.id, {
      signers: signers as Record<string, string> | undefined,
      nodeSecrets: nodeSecrets as Record<string, string> | undefined,
      at: Date.now(),
    });
  }

  res.json({ runId: run.id });
});

/**
 * Execute a run and stream logs over Server-Sent Events. Executing inside the
 * stream keeps a single consumer and real-time delivery; logs + final status
 * are persisted when the run finishes.
 */
runsRouter.get("/:id/stream", async (req, res) => {
  const run = await prisma.run.findUnique({ where: { id: req.params.id } });
  if (!run) return res.status(404).json({ error: "Run not found." });

  const parsed = WorkflowSchema.safeParse(safeJson(run.workflow));
  if (!parsed.success) return res.status(400).json({ error: "Stored workflow is invalid." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const collected: RunLogEvent[] = [];
  await prisma.run.update({ where: { id: run.id }, data: { status: "running" } });

  const saveWallet = async (kp: Keypair, label: string) => {
    await prisma.wallet
      .create({
        data: { publicKey: kp.publicKey(), secret: kp.secret(), network: "testnet", label, funded: true },
      })
      .catch(() => {}); // ignore duplicates
  };

  const signerEntry = pendingSigners.get(run.id);
  pendingSigners.delete(run.id);

  let status: "succeeded" | "failed" = "failed";
  try {
    status = await executeWorkflow(parsed.data, {
      signers: signerEntry?.signers,
      nodeSecrets: signerEntry?.nodeSecrets,
      emit: (event) => {
        collected.push(event);
        send("log", event);
      },
      saveWallet,
    });
  } catch (e) {
    send("log", {
      nodeId: "runtime",
      blockType: "runtime",
      level: "error",
      message: (e as Error).message ?? "Unexpected error.",
      at: Date.now(),
    });
  }

  // Persist logs + final status.
  await prisma.runLog.createMany({
    data: collected.map((l) => ({
      runId: run.id,
      nodeId: l.nodeId,
      blockType: l.blockType,
      level: l.level,
      message: l.message,
      txHash: l.txHash,
    })),
  });
  await prisma.run.update({
    where: { id: run.id },
    data: { status, finishedAt: new Date() },
  });

  send("done", { status });
  res.end();
});

/** Fetch a completed run's logs (history). */
runsRouter.get("/:id", async (req, res) => {
  const run = await prisma.run.findUnique({
    where: { id: req.params.id },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) return res.status(404).json({ error: "Run not found." });
  res.json({ ...run, workflow: safeJson(run.workflow) });
});

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
