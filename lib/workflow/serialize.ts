import type { Edge, Node } from "@xyflow/react";
import { getBlock } from "@/lib/blocks/catalog";
import {
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
  WORKFLOW_SCHEMA_VERSION,
} from "./types";

/** Data fields that hold raw secrets and must never be persisted/exported. */
const SECRET_FIELDS: Record<string, string> = {
  "connect-wallet": "secretKey",
};

/**
 * Strip secret fields out of a workflow, returning a sanitized copy plus the
 * removed secrets keyed by node id. The sanitized workflow is what gets saved,
 * exported, and sent to the backend; the secrets travel separately as ephemeral
 * per-run signers.
 */
export function extractNodeSecrets(wf: Workflow): {
  workflow: Workflow;
  nodeSecrets: Record<string, string>;
} {
  const nodeSecrets: Record<string, string> = {};
  const nodes = wf.nodes.map((n) => {
    const secretKey = SECRET_FIELDS[n.type];
    if (secretKey && typeof n.data?.[secretKey] === "string" && n.data[secretKey]) {
      nodeSecrets[n.id] = n.data[secretKey] as string;
      const { [secretKey]: _omit, ...rest } = n.data;
      return { ...n, data: rest };
    }
    return n;
  });
  return { workflow: { ...wf, nodes }, nodeSecrets };
}

/** Data carried by a React Flow node in the editor. */
export type FlowNodeData = {
  fields: Record<string, unknown>;
};

export type FlowNode = Node<FlowNodeData>;

/** React Flow graph -> portable Workflow JSON. */
export function toWorkflow(
  nodes: FlowNode[],
  edges: Edge[],
  meta: Workflow["meta"]
): Workflow {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    meta,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "unknown",
      position: n.position,
      data: (n.data?.fields as Record<string, unknown>) ?? {},
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === "string" ? e.label : undefined,
    })),
  };
}

/** Portable Workflow JSON -> React Flow graph. */
export function toFlow(workflow: Workflow): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { fields: n.data },
  }));
  const edges: Edge[] = workflow.edges.map((e: WorkflowEdge) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    label: e.label,
  }));
  return { nodes, edges };
}

/**
 * Parse + validate untrusted workflow JSON (e.g. an imported file) into a
 * Workflow. Throws an Error with a human-readable message if the shape is wrong.
 * Unknown block types are rejected here so import fails loudly rather than
 * loading nodes the editor can't render.
 */
export function deserializeWorkflow(raw: unknown): Workflow {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Not a workflow — expected a JSON object.");
  }
  const obj = raw as Record<string, unknown>;

  const meta = obj.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta.name !== "string") {
    throw new Error("Missing meta.name — is this a Soroban Studio workflow?");
  }
  const network = meta.network === "mainnet" ? "mainnet" : "testnet";

  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    throw new Error("Workflow must have nodes and edges arrays.");
  }

  const nodes: WorkflowNode[] = obj.nodes.map((n, i) => {
    const node = n as Record<string, unknown>;
    if (typeof node.id !== "string" || typeof node.type !== "string") {
      throw new Error(`Node ${i} is missing an id or type.`);
    }
    if (!getBlock(node.type)) {
      throw new Error(`Unknown block type "${node.type}" — can't import.`);
    }
    const pos = node.position as Record<string, unknown> | undefined;
    return {
      id: node.id,
      type: node.type,
      position: {
        x: typeof pos?.x === "number" ? pos.x : 0,
        y: typeof pos?.y === "number" ? pos.y : 0,
      },
      data: (node.data as Record<string, unknown>) ?? {},
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: WorkflowEdge[] = obj.edges.map((e, i) => {
    const edge = e as Record<string, unknown>;
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      throw new Error(`Edge ${i} is missing a source or target.`);
    }
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`Edge ${i} references a node that doesn't exist.`);
    }
    return {
      id: typeof edge.id === "string" ? edge.id : `e-${edge.source}-${edge.target}-${i}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
      label: typeof edge.label === "string" ? edge.label : undefined,
    };
  });

  return {
    version: WORKFLOW_SCHEMA_VERSION,
    meta: {
      name: meta.name,
      description: typeof meta.description === "string" ? meta.description : undefined,
      network,
    },
    nodes,
    edges,
  };
}

/**
 * Lightweight structural validation. Returns a list of human-readable problems
 * (empty === valid). Used before sandbox runs and code export.
 */
export function validateWorkflow(wf: Workflow): string[] {
  const problems: string[] = [];
  const ids = new Set(wf.nodes.map((n) => n.id));

  if (wf.nodes.length === 0) problems.push("Workflow has no blocks.");

  const hasTrigger = wf.nodes.some(
    (n) => getBlock(n.type)?.category === "trigger"
  );
  if (wf.nodes.length > 0 && !hasTrigger) {
    problems.push("Workflow needs a trigger block to start.");
  }

  for (const n of wf.nodes) {
    const def = getBlock(n.type);
    if (!def) {
      problems.push(`Unknown block type "${n.type}".`);
      continue;
    }
    for (const f of def.fields) {
      if (f.required && !n.data[f.key]) {
        problems.push(`"${def.label}" is missing required field "${f.label}".`);
      }
    }
  }

  for (const e of wf.edges) {
    if (!ids.has(e.source)) problems.push(`Edge ${e.id} has an unknown source.`);
    if (!ids.has(e.target)) problems.push(`Edge ${e.id} has an unknown target.`);
  }

  return problems;
}

/**
 * Topological execution order (Kahn's algorithm). Cyclic graphs return the
 * nodes that could be ordered plus the leftovers appended, so the sandbox can
 * still surface a best-effort run.
 */
export function executionOrder(wf: Workflow): WorkflowNode[] {
  const indegree = new Map<string, number>();
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  for (const n of wf.nodes) indegree.set(n.id, 0);
  for (const e of wf.edges) {
    if (indegree.has(e.target)) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: WorkflowNode[] = [];
  const seen = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) order.push(node);
    for (const e of wf.edges.filter((e) => e.source === id)) {
      const d = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, d);
      if (d <= 0) queue.push(e.target);
    }
  }

  // Append any nodes left out by cycles so nothing silently disappears.
  for (const n of wf.nodes) if (!seen.has(n.id)) order.push(n);
  return order;
}
