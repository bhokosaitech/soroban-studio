import { Router } from "express";
import { prisma } from "../db.js";
import { WorkflowSchema } from "../workflow.js";
import { cancelSchedule, scheduleWorkflow, schedulerMode } from "../scheduler/index.js";

export const schedulesRouter = Router();

/** Create a scheduled run. Body: { workflow, runAt } */
schedulesRouter.post("/", async (req, res) => {
  const parsed = WorkflowSchema.safeParse(req.body?.workflow);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid workflow.", details: parsed.error.flatten() });
  }
  const runAtRaw = req.body?.runAt;
  const runAt = new Date(runAtRaw);
  if (Number.isNaN(runAt.getTime())) {
    return res.status(400).json({ error: "Invalid runAt date." });
  }
  if (runAt.getTime() < Date.now() - 60_000) {
    return res.status(400).json({ error: "runAt must be in the future." });
  }

  const wf = parsed.data;
  const schedule = await prisma.schedule.create({
    data: {
      name: wf.meta.name,
      workflow: JSON.stringify(wf),
      runAt,
      status: "scheduled",
    },
  });
  await scheduleWorkflow(schedule.id, runAt);

  res.json({ ...schedule, mode: schedulerMode });
});

/** List schedules (newest first). */
schedulesRouter.get("/", async (_req, res) => {
  const schedules = await prisma.schedule.findMany({ orderBy: { runAt: "asc" } });
  res.json({ mode: schedulerMode, schedules });
});

/** Cancel a schedule. */
schedulesRouter.delete("/:id", async (req, res) => {
  await cancelSchedule(req.params.id);
  res.json({ ok: true });
});
