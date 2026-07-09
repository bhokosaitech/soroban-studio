import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../db";
import { runScheduleNow } from "./runner";

/**
 * Workflow scheduler.
 *
 * Primary path: BullMQ delayed jobs on Redis (durable, survives restarts).
 * Fallback: if Redis can't be reached, a simple in-process poller scans the DB
 * for due schedules. Either way the DB `Schedule` row is the source of truth,
 * so the two modes are interchangeable.
 */

const QUEUE_NAME = "workflow-schedules";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

let queue: Queue | null = null;
let worker: Worker | null = null;
let pollTimer: NodeJS.Timeout | null = null;
export let schedulerMode: "redis" | "polling" = "polling";

export async function initScheduler(): Promise<void> {
  // Probe Redis with a short-lived client so we can pick a mode without hanging.
  const probe = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null, // don't hammer a missing Redis
  });

  try {
    await probe.connect();
    await probe.ping();
    probe.disconnect();

    // BullMQ manages its own connection from plain options (avoids ioredis
    // version clashes with the bundled copy).
    const u = new URL(REDIS_URL);
    const connection = {
      host: u.hostname,
      port: Number(u.port || 6379),
      maxRetriesPerRequest: null as null,
    };
    queue = new Queue(QUEUE_NAME, { connection });
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await runScheduleNow(job.data.scheduleId as string);
      },
      { connection }
    );
    worker.on("failed", (job, err) => console.error(`Schedule job ${job?.id} failed:`, err.message));
    schedulerMode = "redis";
    console.log("⏰ Scheduler: Redis (BullMQ) mode.");
  } catch {
    probe.disconnect();
    schedulerMode = "polling";
    startPoller();
    console.log("⏰ Scheduler: DB polling mode (Redis not reachable).");
  }

  // Reconcile anything already past-due (covers downtime in either mode).
  await fireDueNow();
}

/** Register a schedule to fire at `runAt`. */
export async function scheduleWorkflow(scheduleId: string, runAt: Date): Promise<void> {
  if (schedulerMode === "redis" && queue) {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    await queue.add("run", { scheduleId }, { delay, jobId: scheduleId, removeOnComplete: true, removeOnFail: true });
  }
  // Polling mode needs no registration — the poller finds it by runAt.
}

/** Cancel a pending schedule. */
export async function cancelSchedule(scheduleId: string): Promise<void> {
  await prisma.schedule.updateMany({
    where: { id: scheduleId, status: "scheduled" },
    data: { status: "canceled" },
  });
  if (schedulerMode === "redis" && queue) {
    await queue.remove(scheduleId).catch(() => {});
  }
}

function startPoller() {
  if (pollTimer) return;
  pollTimer = setInterval(fireDueNow, 10_000);
}

/** Find and run every schedule whose time has passed. */
async function fireDueNow() {
  try {
    const due = await prisma.schedule.findMany({
      where: { status: "scheduled", runAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const s of due) await runScheduleNow(s.id).catch((e) => console.error(e));
  } catch (e) {
    // DB unreachable — skip this tick rather than crash the poller/boot.
    console.error("Scheduler sweep failed:", (e as Error).message);
  }
}
