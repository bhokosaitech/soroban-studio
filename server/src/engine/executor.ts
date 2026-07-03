import type { Keypair } from "@stellar/stellar-sdk";
import { executionOrder, type Workflow } from "../workflow.js";
import { getHandler } from "./handlers.js";
import type { RunContext, RunLogEvent } from "./types.js";

export interface ExecuteCallbacks {
  emit: (event: RunLogEvent) => void;
  saveWallet: (kp: Keypair, label: string) => Promise<void>;
  /** Ephemeral signers for vault wallets, keyed by public key. */
  signers?: Record<string, string>;
  /** Ephemeral external secret keys, keyed by node id. */
  nodeSecrets?: Record<string, string>;
}

/**
 * Execute a workflow against real Stellar testnet.
 *
 * Walks the graph in topological order but respects branching: a node runs only
 * if it was *reached* by an enabled incoming edge. Condition blocks enable just
 * the edge whose handle ("true"/"false") matches their result, so the other
 * branch is skipped. Nodes with no incoming edges (triggers) are entry points.
 */
export async function executeWorkflow(
  wf: Workflow,
  cb: ExecuteCallbacks
): Promise<"succeeded" | "failed"> {
  const ctx: RunContext = {
    outputs: {},
    signers: cb.signers,
    nodeSecrets: cb.nodeSecrets,
    saveWallet: cb.saveWallet,
    emit: (event) => cb.emit({ ...event, at: Date.now() }),
  };

  ctx.emit({ nodeId: "runtime", blockType: "runtime", level: "info", message: `Executing "${wf.meta.name}" on testnet.` });

  const order = executionOrder(wf);
  const labelOf = (id: string) => wf.nodes.find((n) => n.id === id)?.type ?? id;

  // Entry points: nodes with no incoming edges.
  const hasIncoming = new Set(wf.edges.map((e) => e.target));
  const reached = new Set(wf.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id));

  let failed = false;

  for (const node of order) {
    if (!reached.has(node.id)) {
      // Reached only via a branch that wasn't taken — skip quietly.
      if (hasIncoming.has(node.id)) {
        ctx.emit({ nodeId: node.id, blockType: node.type, level: "info", message: `Skipped ${node.type} — branch not taken.` });
      }
      continue;
    }

    // Terminal gating: success/error terminals depend on run outcome so far.
    if (node.type === "on-error" && !failed) continue;
    if (node.type === "on-success" && failed) continue;

    const handler = getHandler(node.type);
    if (!handler) {
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "warn", message: `No handler for "${node.type}" — skipped.` });
      enableOutgoing(node.id);
      continue;
    }

    try {
      await handler(node, ctx);
      enableOutgoing(node.id);
    } catch (e) {
      failed = true;
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "error", message: (e as Error).message ?? "Step failed." });
      for (const errNode of order.filter((n) => n.type === "on-error")) {
        const h = getHandler(errNode.type);
        if (h) await h(errNode, ctx).catch(() => {});
      }
      break;
    }
  }

  ctx.emit({
    nodeId: "runtime",
    blockType: "runtime",
    level: failed ? "error" : "success",
    message: failed ? "Run failed." : "Run complete.",
  });
  return failed ? "failed" : "succeeded";

  /** Mark the targets of a node's enabled outgoing edges as reached. */
  function enableOutgoing(nodeId: string) {
    const isCondition = labelOf(nodeId) === "condition";
    const result = Boolean(ctx.outputs[nodeId]?.result);
    for (const e of wf.edges.filter((x) => x.source === nodeId)) {
      let enabled = true;
      if (isCondition) {
        const h = e.sourceHandle;
        if (h === "true") enabled = result;
        else if (h === "false") enabled = !result;
        // an unhandled (null) edge from a condition is treated as unconditional
      }
      if (enabled) reached.add(e.target);
    }
  }
}
