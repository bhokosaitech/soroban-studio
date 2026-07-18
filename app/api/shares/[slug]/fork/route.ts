import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/shares/:slug/fork — copy a forkable shared workflow into the caller's own workspace. */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const share = await prisma.share.findUnique({ where: { slug } });
  if (!share || share.revoked) {
    return NextResponse.json({ error: "This share link doesn't exist or was revoked." }, { status: 404 });
  }
  if (share.mode !== "fork") {
    return NextResponse.json({ error: "This workflow is read-only and can't be forked." }, { status: 403 });
  }

  const project = await prisma.project.create({
    data: {
      name: `${share.name} (fork)`,
      description: share.description,
      network: share.network,
      workflow: share.workflow,
      ownerId: user.id,
    },
  });
  return NextResponse.json({ id: project.id });
}
