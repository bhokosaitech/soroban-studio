import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";
import { uniqueShareSlug, isShareMode } from "@/lib/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projects/:id/share — the project's active share link, if any. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const share = await prisma.share.findFirst({
    where: { projectId: id, revoked: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ share: share ? toShareInfo(share) : null });
}

/** POST /api/projects/:id/share — publish (or re-fetch) the project's share link. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = isShareMode(body?.mode) ? body.mode : "readonly";

  // Reuse the project's existing active share rather than minting a new URL
  // every time the dialog is opened.
  const existing = await prisma.share.findFirst({
    where: { projectId: id, revoked: false },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return NextResponse.json({ share: toShareInfo(existing) });

  const slug = await uniqueShareSlug();
  const share = await prisma.share.create({
    data: {
      slug,
      name: project.name,
      description: project.description,
      network: project.network,
      workflow: project.workflow,
      mode,
      authorName: user.name ?? user.email,
      ownerId: user.id,
      projectId: id,
    },
  });
  return NextResponse.json({ share: toShareInfo(share) });
}

/** PATCH /api/projects/:id/share — update the active share's mode, or revoke it. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const share = await prisma.share.findFirst({
    where: { projectId: id, revoked: false },
    orderBy: { createdAt: "desc" },
  });
  if (!share) return NextResponse.json({ error: "No active share link." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { mode?: string; revoked?: boolean } = {};
  if (isShareMode(body?.mode)) data.mode = body.mode;
  if (typeof body?.revoked === "boolean") data.revoked = body.revoked;

  const updated = await prisma.share.update({ where: { id: share.id }, data });
  return NextResponse.json({ share: toShareInfo(updated) });
}

function toShareInfo(share: {
  slug: string;
  mode: string;
  revoked: boolean;
  authorName: string | null;
}) {
  return {
    slug: share.slug,
    mode: share.mode,
    revoked: share.revoked,
    authorName: share.authorName,
  };
}
