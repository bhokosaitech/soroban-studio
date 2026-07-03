import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { defaultData } from "@/lib/blocks/catalog";
import {
  emptyWorkflow,
  toFlow,
  toWorkflow,
  type FlowNode,
  type Workflow,
  type WorkflowMeta,
} from "@/lib/workflow";

let nodeSeq = 1;
const nextId = () => `node_${nodeSeq++}`;

interface EditorState {
  nodes: FlowNode[];
  edges: Edge[];
  meta: WorkflowMeta;
  selectedId: string | null;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addBlock: (type: string, position: { x: number; y: number }) => void;
  updateField: (nodeId: string, key: string, value: unknown) => void;
  removeNode: (nodeId: string) => void;
  select: (nodeId: string | null) => void;
  setMeta: (patch: Partial<WorkflowMeta>) => void;

  loadWorkflow: (wf: Workflow) => void;
  toWorkflow: () => Workflow;
  clear: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  meta: emptyWorkflow().meta,
  selectedId: null,

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) as FlowNode[] }),
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) =>
    set({ edges: addEdge({ ...connection, animated: true }, get().edges) }),

  addBlock: (type, position) => {
    const node: FlowNode = {
      id: nextId(),
      type,
      position,
      data: { fields: defaultData(type) },
    };
    set({ nodes: [...get().nodes, node], selectedId: node.id });
  },

  updateField: (nodeId, key, value) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, fields: { ...n.data.fields, [key]: value } } }
          : n
      ),
    }),

  removeNode: (nodeId) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedId: get().selectedId === nodeId ? null : get().selectedId,
    }),

  select: (nodeId) => set({ selectedId: nodeId }),
  setMeta: (patch) => set({ meta: { ...get().meta, ...patch } }),

  loadWorkflow: (wf) => {
    const { nodes, edges } = toFlow(wf);
    // Keep the id sequence ahead of any loaded ids.
    for (const n of nodes) {
      const m = /(\d+)$/.exec(n.id);
      if (m) nodeSeq = Math.max(nodeSeq, Number(m[1]) + 1);
    }
    set({ nodes, edges, meta: wf.meta, selectedId: null });
  },

  toWorkflow: () => toWorkflow(get().nodes, get().edges, get().meta),

  clear: () => set({ nodes: [], edges: [], selectedId: null }),
}));
