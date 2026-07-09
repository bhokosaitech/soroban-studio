import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { WorkflowSchema } from "@/lib/server/workflow-schema";
import { stashSigners } from "@/lib/server/pending-signers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/runs — create a run from a workflow. Returns { runId } to stream. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const parsed = WorkflowSchema.safeParse(body?.workflow);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const wf = parsed.data;

  const run = await prisma.run.create({
    data: {
      network: wf.meta.network,
      workflow: JSON.stringify(wf),
      status: "pending",
      projectId: typeof body?.projectId === "string" ? body.projectId : undefined,
    },
  });

  // Stash any provided secrets in memory (not persisted).
  const signers = body?.signers;
  const nodeSecrets = body?.nodeSecrets;
  if ((signers && typeof signers === "object") || (nodeSecrets && typeof nodeSecrets === "object")) {
    stashSigners(run.id, {
      signers: signers as Record<string, string> | undefined,
      nodeSecrets: nodeSecrets as Record<string, string> | undefined,
    });
  }

  return NextResponse.json({ runId: run.id });
}
