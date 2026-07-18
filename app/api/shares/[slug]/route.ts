import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/shares/:slug — public, read-only fetch of a shared workflow snapshot. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const share = await prisma.share.findUnique({ where: { slug } });
  if (!share || share.revoked) {
    return NextResponse.json({ error: "This share link doesn't exist or was revoked." }, { status: 404 });
  }

  return NextResponse.json({
    slug: share.slug,
    name: share.name,
    description: share.description,
    network: share.network,
    workflow: safeJson(share.workflow),
    mode: share.mode,
    authorName: share.authorName,
    createdAt: share.createdAt,
  });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
