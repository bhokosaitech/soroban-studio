/**
 * Runs once when a Next.js server instance boots. We start the workflow
 * scheduler here (BullMQ if Redis is reachable, else a DB poller) so the single
 * process owns both the HTTP API and the background scheduler.
 *
 * Guarded to the Node.js runtime (the scheduler uses ioredis/bullmq) and to a
 * single init, since dev can re-invoke register().
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __schedulerStarted?: boolean };
  if (g.__schedulerStarted) return;
  g.__schedulerStarted = true;

  const { initScheduler } = await import("@/lib/server/scheduler");
  try {
    await initScheduler();
  } catch (e) {
    // A missing DB / unreachable Redis at boot must not stop the HTTP server —
    // the scheduler simply won't run until the next start.
    console.error("Scheduler init failed:", (e as Error).message);
  }
}
