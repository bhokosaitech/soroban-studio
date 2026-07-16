"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitFork, Loader2 } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { BLOCK_CATALOG } from "@/lib/blocks/catalog";
import { toFlow, type Workflow } from "@/lib/workflow";
import { forkShare, UnauthorizedError } from "@/lib/api";
import { BlockNode } from "@/components/editor/nodes/BlockNode";

export function SharedWorkflowViewer({
  slug,
  name,
  description,
  network,
  workflow,
  mode,
  authorName,
}: {
  slug: string;
  name: string;
  description?: string | null;
  network: string;
  workflow: Workflow;
  mode: "readonly" | "fork";
  authorName?: string | null;
}) {
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => toFlow(workflow), [workflow]);
  const nodeTypes = useMemo<NodeTypes>(
    () => Object.fromEntries(BLOCK_CATALOG.map((b) => [b.type, BlockNode])),
    []
  );

  async function fork() {
    setForking(true);
    setError(null);
    try {
      const { id } = await forkShare(slug);
      router.push(`/editor?project=${id}`);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        router.push(`/login?next=${encodeURIComponent(`/share/${slug}`)}`);
        return;
      }
      setError(e instanceof Error ? e.message : "Could not fork this workflow.");
      setForking(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-off">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="text-border">/</span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium text-ink">{name}</div>
            {(description || authorName) && (
              <div className="truncate text-[11.5px] text-muted">
                {authorName ? `by ${authorName}` : ""}
                {authorName && description ? " — " : ""}
                {description ?? ""}
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted">
            {network}
          </span>
          <span className="shrink-0 rounded-full bg-off px-2 py-0.5 text-[11px] font-medium text-muted">
            {mode === "fork" ? "Forkable" : "Read-only"}
          </span>
        </div>

        {mode === "fork" && (
          <button
            onClick={fork}
            disabled={forking}
            className="btn-dark flex shrink-0 items-center gap-1.5 disabled:opacity-50"
          >
            {forking ? <Loader2 size={14} className="animate-spin" /> : <GitFork size={14} />}
            Fork this workflow
          </button>
        )}
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-[12.5px] text-red-600">{error}</div>
      )}

      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, style: { stroke: "#c9c7c0" } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#dedcd4" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
