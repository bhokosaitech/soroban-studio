import type { Keypair } from "@stellar/stellar-sdk";
import { executionOrder, type Workflow, type WorkflowNode } from "../workflow-schema";
import { getServerNetwork } from "../stellar/network";
import { getHandler } from "./handlers";
import { applyLoopVars, resolveLoopItems } from "./loop";
import type { RunContext, RunLogEvent } from "./types";

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
  const net = getServerNetwork(wf.meta.network);
  const ctx: RunContext = {
    net,
    outputs: {},
    signers: cb.signers,
    nodeSecrets: cb.nodeSecrets,
    saveWallet: cb.saveWallet,
    emit: (event) => cb.emit({ ...event, at: Date.now() }),
  };

  ctx.emit({ nodeId: "runtime", blockType: "runtime", level: "info", message: `Executing "${wf.meta.name}" on ${net.id}.` });
  if (net.id === "mainnet") {
    ctx.emit({ nodeId: "runtime", blockType: "runtime", level: "warn", message: "⚠ MAINNET — real funds will move." });
  }

  const order = executionOrder(wf);
  const labelOf = (id: string) => wf.nodes.find((n) => n.id === id)?.type ?? id;

  // Entry points: nodes with no incoming edges.
  const hasIncoming = new Set(wf.edges.map((e) => e.target));
  const reached = new Set(wf.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id));

  // A Loop / Batch node repeats the single node connected after it; that node
  // runs inside the loop's own step below, not as a standalone step in `order`.
  const loopOwnerOf = new Map<string, WorkflowNode>();
  for (const n of wf.nodes) {
    if (n.type !== "loop-batch") continue;
    const bodyEdge = wf.edges.find((e) => e.source === n.id);
    if (bodyEdge) loopOwnerOf.set(bodyEdge.target, n);
  }

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

    // Already executed (repeatedly) by its owning Loop / Batch node above —
    // just propagate reachability to whatever comes after it.
    if (loopOwnerOf.has(node.id)) {
      enableOutgoing(node.id);
      continue;
    }

    if (node.type === "loop-batch") {
      const bodyEdge = wf.edges.find((e) => e.source === node.id);
      const bodyNode = bodyEdge ? wf.nodes.find((n) => n.id === bodyEdge.target) : undefined;
      try {
        await runLoopBatch(node, bodyNode, ctx);
        enableOutgoing(node.id);
      } catch (e) {
        failed = true;
        ctx.emit({ nodeId: node.id, blockType: node.type, level: "error", message: (e as Error).message ?? "Loop failed." });
        for (const errNode of order.filter((n) => n.type === "on-error")) {
          const h = getHandler(errNode.type);
          if (h) await h(errNode, ctx).catch(() => {});
        }
        break;
      }
      continue;
    }

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

/**
 * Run a Loop / Batch node: repeats `bodyNode` once per resolved item (or
 * `count` times), substituting {{item}} / {{index}} into its field values.
 * Failed iterations are logged and counted but don't abort the loop unless
 * `continueOnError` is off.
 */
async function runLoopBatch(loopNode: WorkflowNode, bodyNode: WorkflowNode | undefined, ctx: RunContext) {
  const items = resolveLoopItems(loopNode.data);
  const continueOnError = loopNode.data.continueOnError !== false;

  if (!bodyNode) {
    ctx.emit({
      nodeId: loopNode.id,
      blockType: loopNode.type,
      level: "warn",
      message: "Loop / Batch has no step connected after it — nothing to repeat.",
    });
    ctx.outputs[loopNode.id] = { iterations: 0, succeeded: 0, failed: 0, results: [] };
    return;
  }

  const handler = getHandler(bodyNode.type);
  ctx.emit({
    nodeId: loopNode.id,
    blockType: loopNode.type,
    level: "info",
    message: `Loop / Batch: ${items.length} iteration(s) of "${bodyNode.type}".`,
  });

  let succeeded = 0;
  let failed = 0;
  const results: Array<{ index: number; item: string; ok: boolean; error?: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    ctx.emit({
      nodeId: loopNode.id,
      blockType: loopNode.type,
      level: "info",
      message: `Iteration ${i + 1}/${items.length} — item: ${item}`,
    });

    const iterationNode: WorkflowNode = { ...bodyNode, data: applyLoopVars(bodyNode.data, { item, index: i }) };
    try {
      if (!handler) throw new Error(`No handler for "${bodyNode.type}".`);
      await handler(iterationNode, ctx);
      succeeded++;
      results.push({ index: i, item, ok: true });
    } catch (e) {
      failed++;
      const message = (e as Error).message ?? "Iteration failed.";
      results.push({ index: i, item, ok: false, error: message });
      ctx.emit({
        nodeId: bodyNode.id,
        blockType: bodyNode.type,
        level: "error",
        message: `Iteration ${i + 1} failed: ${message}`,
      });
      if (!continueOnError) {
        ctx.outputs[loopNode.id] = { iterations: items.length, succeeded, failed, results };
        throw new Error(`Loop stopped at iteration ${i + 1}: ${message}`);
      }
    }
  }

  ctx.outputs[loopNode.id] = { iterations: items.length, succeeded, failed, results };
  ctx.emit({
    nodeId: loopNode.id,
    blockType: loopNode.type,
    level: failed && !succeeded ? "error" : "success",
    message: `Loop complete — ${succeeded}/${items.length} succeeded${failed ? `, ${failed} failed` : ""}.`,
  });
}
