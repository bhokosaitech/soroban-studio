import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/runs/:id — fetch a completed run's logs (history). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const run = await prisma.run.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  return NextResponse.json({ ...run, workflow: safeJson(run.workflow) });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
