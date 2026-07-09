import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { WorkflowSchema } from "@/lib/server/workflow-schema";
import { getSessionUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projects — list the signed-in user's saved projects (newest first). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(projects.map((p) => ({ ...p, workflow: safeJson(p.workflow) })));
}

/** POST /api/projects — create or update a project from a workflow. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = WorkflowSchema.safeParse(body?.workflow);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const wf = parsed.data;
  const id = typeof body?.id === "string" ? body.id : undefined;

  const data = {
    name: wf.meta.name,
    description: wf.meta.description,
    network: wf.meta.network,
    workflow: JSON.stringify(wf),
  };
  const createData = { ...data, ownerId: user.id };

  const project = id
    ? await prisma.project.upsert({ where: { id }, update: data, create: createData })
    : await prisma.project.create({ data: createData });

  return NextResponse.json({ ...project, workflow: wf });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
