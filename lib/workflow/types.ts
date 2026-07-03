/**
 * Workflow JSON schema — the serializable, portable representation of a
 * Soroban Studio project. This is what gets saved, shared, fed to the code
 * generator, and produced by the AI Builder.
 *
 * It is deliberately decoupled from React Flow's internal types so the format
 * stays stable and tool-agnostic.
 */

export const WORKFLOW_SCHEMA_VERSION = 1 as const;

export interface WorkflowNode {
  /** Unique node id within the workflow. */
  id: string;
  /** Block type from the catalog, e.g. "send-payment". */
  type: string;
  /** Canvas position. */
  position: { x: number; y: number };
  /** Field values keyed by BlockField.key. */
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  /** Optional source handle (e.g. condition "true"/"false"). */
  sourceHandle?: string | null;
  label?: string;
}

export interface WorkflowMeta {
  name: string;
  description?: string;
  network: "testnet" | "mainnet";
}

export interface Workflow {
  version: typeof WORKFLOW_SCHEMA_VERSION;
  meta: WorkflowMeta;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export function emptyWorkflow(name = "Untitled workflow"): Workflow {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    meta: { name, network: "testnet" },
    nodes: [],
    edges: [],
  };
}
