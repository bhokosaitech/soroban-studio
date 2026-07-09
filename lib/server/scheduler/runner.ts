import { Keypair } from "@stellar/stellar-sdk";
import { prisma } from "../db";
import { WorkflowSchema } from "../workflow-schema";
import { executeWorkflow } from "../engine/executor";
import type { RunLogEvent } from "../engine/types";

/**
 * Execute a due schedule headlessly (no SSE client). Loads the schedule's
 * workflow, runs it against testnet, persists a Run + logs, and marks the
 * schedule done/failed. Safe to call more than once — it no-ops unless the
 * schedule is still "scheduled".
 */
export async function runScheduleNow(scheduleId: string): Promise<void> {
  // Atomically claim the schedule so concurrent triggers can't double-run it.
  const claim = await prisma.schedule.updateMany({
    where: { id: scheduleId, status: "scheduled" },
    data: { status: "running" },
  });
  if (claim.count === 0) return;

  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return;

  const parsed = WorkflowSchema.safeParse(safeJson(schedule.workflow));
  if (!parsed.success) {
    await prisma.schedule.update({ where: { id: scheduleId }, data: { status: "failed" } });
    return;
  }

  const run = await prisma.run.create({
    data: { network: "testnet", workflow: schedule.workflow, status: "running" },
  });

  const logs: RunLogEvent[] = [];
  let status: "succeeded" | "failed" = "failed";
  try {
    status = await executeWorkflow(parsed.data, {
      emit: (e) => logs.push(e),
      saveWallet: async (kp: Keypair, label) => {
        await prisma.wallet
          .create({ data: { publicKey: kp.publicKey(), secret: kp.secret(), network: "testnet", label, funded: true } })
          .catch(() => {});
      },
    });
  } catch {
    /* status stays failed */
  }

  await prisma.runLog.createMany({
    data: logs.map((l) => ({
      runId: run.id,
      nodeId: l.nodeId,
      blockType: l.blockType,
      level: l.level,
      message: l.message,
      txHash: l.txHash,
    })),
  });
  await prisma.run.update({ where: { id: run.id }, data: { status, finishedAt: new Date() } });
  await prisma.schedule.update({
    where: { id: scheduleId },
    data: { status: status === "succeeded" ? "done" : "failed", lastRunId: run.id },
  });

  console.log(`⏰ Schedule ${scheduleId} fired → run ${run.id} (${status}).`);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
