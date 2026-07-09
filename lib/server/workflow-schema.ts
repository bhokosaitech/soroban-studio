import { z } from "zod";

/** Server-side mirror of the frontend Workflow JSON schema. */
export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  label: z.string().optional(),
});

export const WorkflowSchema = z.object({
  version: z.number().default(1),
  meta: z.object({
    name: z.string().default("Untitled workflow"),
    description: z.string().optional(),
    network: z.enum(["testnet", "mainnet"]).default("testnet"),
  }),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

/** Kahn topological order; cyclic leftovers appended so nothing is dropped. */
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
  for (const n of wf.nodes) if (!seen.has(n.id)) order.push(n);
  return order;
}
