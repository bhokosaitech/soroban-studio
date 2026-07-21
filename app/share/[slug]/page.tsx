import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { SharedWorkflowViewer } from "@/components/share/SharedWorkflowViewer";
import type { Workflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await prisma.share.findUnique({ where: { slug } });
  if (!share || share.revoked) notFound();

  const workflow = safeJson(share.workflow) as Workflow | null;
  if (!workflow) notFound();

  return (
    <SharedWorkflowViewer
      slug={share.slug}
      name={share.name}
      description={share.description}
      network={share.network}
      workflow={workflow}
      mode={share.mode === "fork" ? "fork" : "readonly"}
      authorName={share.authorName}
    />
  );
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
