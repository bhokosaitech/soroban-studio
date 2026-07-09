import { NextResponse } from "next/server";
import type { Keypair } from "@stellar/stellar-sdk";
import { prisma } from "@/lib/server/db";
import { WorkflowSchema } from "@/lib/server/workflow-schema";
import { executeWorkflow } from "@/lib/server/engine/executor";
import type { RunLogEvent } from "@/lib/server/engine/types";
import { consumeSigners } from "@/lib/server/pending-signers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Runs can poll Horizon for incoming payments up to a block's timeout.
export const maxDuration = 300;

/**
 * GET /api/runs/:id/stream — execute a run and stream logs over Server-Sent
 * Events. Executing inside the stream keeps a single consumer and real-time
 * delivery; logs + final status are persisted when the run finishes.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const parsed = WorkflowSchema.safeParse(safeJson(run.workflow));
  if (!parsed.success) {
    return NextResponse.json({ error: "Stored workflow is invalid." }, { status: 400 });
  }
  const workflow = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
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

      const signerEntry = consumeSigners(run.id);

      let status: "succeeded" | "failed" = "failed";
      try {
        status = await executeWorkflow(workflow, {
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
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
