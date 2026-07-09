import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { WorkflowSchema } from "@/lib/server/workflow-schema";
import { scheduleWorkflow, schedulerMode } from "@/lib/server/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/schedules — create a scheduled run. Body: { workflow, runAt } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const parsed = WorkflowSchema.safeParse(body?.workflow);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const runAt = new Date(body?.runAt);
  if (Number.isNaN(runAt.getTime())) {
    return NextResponse.json({ error: "Invalid runAt date." }, { status: 400 });
  }
  if (runAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "runAt must be in the future." }, { status: 400 });
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

  return NextResponse.json({ ...schedule, mode: schedulerMode });
}

/** GET /api/schedules — list schedules (soonest first). */
export async function GET() {
  const schedules = await prisma.schedule.findMany({ orderBy: { runAt: "asc" } });
  return NextResponse.json({ mode: schedulerMode, schedules });
}
