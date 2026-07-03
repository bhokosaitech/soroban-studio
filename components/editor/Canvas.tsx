"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BLOCK_CATALOG } from "@/lib/blocks/catalog";
import { useEditorStore } from "@/lib/store/editor";
import { BlockNode } from "./nodes/BlockNode";

export function Canvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addBlock,
    select,
  } = useEditorStore();

  // Register one renderer for every catalog block type.
  const nodeTypes = useMemo<NodeTypes>(
    () => Object.fromEntries(BLOCK_CATALOG.map((b) => [b.type, BlockNode])),
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/soroban-block");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addBlock(type, position);
    },
    [screenToFlowPosition, addBlock]
  );

  return (
    <div ref={wrapper} data-guide="canvas" className="h-full flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => select(n.id)}
        onPaneClick={() => select(null)}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true, style: { stroke: "#c9c7c0" } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#dedcd4" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
