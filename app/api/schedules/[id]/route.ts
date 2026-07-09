import { NextResponse } from "next/server";
import { cancelSchedule } from "@/lib/server/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/schedules/:id — cancel a pending schedule. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await cancelSchedule(id);
  return NextResponse.json({ ok: true });
}
