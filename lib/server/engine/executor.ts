import type { Keypair } from "@stellar/stellar-sdk";
import { executionOrder, type Workflow, getDownstreamNodeIds } from "../workflow-schema";
import { getServerNetwork } from "../stellar/network";
import { getHandler } from "./handlers";
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

  const csvNode = wf.nodes.find((n) => n.type === "csv-import");
  const downstreamIds = csvNode ? getDownstreamNodeIds(wf, csvNode.id) : new Set<string>();

  // Entry points: nodes with no incoming edges.
  const hasIncoming = new Set(wf.edges.map((e) => e.target));
  const reached = new Set(wf.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id));

  let failed = false;

  for (const node of order) {
    if (downstreamIds.has(node.id)) {
      // These nodes are executed inside the csv-import loop below. Skip them here.
      continue;
    }

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
      
      if (node.type === "csv-import") {
        const rows = (node.data?.rows as any[]) || [];
        const mappings = (node.data?.mappings as Record<string, string>) || {};
        
        if (rows.length === 0) {
          ctx.emit({
            nodeId: node.id,
            blockType: node.type,
            level: "warn",
            message: "CSV Import: No rows to process.",
          });
          enableOutgoing(node.id);
          continue;
        }

        ctx.emit({
          nodeId: node.id,
          blockType: node.type,
          level: "info",
          message: `CSV Import: Starting batch processing of ${rows.length} rows.`,
        });

        let batchFailed = false;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          ctx.emit({
            nodeId: node.id,
            blockType: node.type,
            level: "info",
            message: `--- Processing row ${i + 1} of ${rows.length} ---`,
          });

          // Map the row fields to the workflow input keys
          const mappedRow: Record<string, any> = {};
          for (const [wfKey, csvCol] of Object.entries(mappings)) {
            if (csvCol && row[csvCol] !== undefined) {
              mappedRow[wfKey] = row[csvCol];
            }
          }

          ctx.currentRow = mappedRow;

          // Run downstream nodes for this row
          const rowReached = new Set<string>();
          // Add targets of the csv-import node to start
          for (const edge of wf.edges.filter((e) => e.source === node.id)) {
            rowReached.add(edge.target);
          }

          let rowFailed = false;
          const downstreamOrder = order.filter((n) => downstreamIds.has(n.id));

          for (const dsNode of downstreamOrder) {
            if (!rowReached.has(dsNode.id)) {
              continue;
            }

            if (dsNode.type === "on-error" && !rowFailed) continue;
            if (dsNode.type === "on-success" && rowFailed) continue;

            const dsHandler = getHandler(dsNode.type);
            if (!dsHandler) {
              enableRowOutgoing(dsNode.id);
              continue;
            }

            try {
              await dsHandler(dsNode, ctx);
              enableRowOutgoing(dsNode.id);
            } catch (err) {
              rowFailed = true;
              ctx.emit({
                nodeId: dsNode.id,
                blockType: dsNode.type,
                level: "error",
                message: `Row ${i + 1} failed: ${(err as Error).message ?? "Step failed."}`,
              });
              // Execute on-error handlers for this row
              for (const errNode of downstreamOrder.filter((n) => n.type === "on-error")) {
                const h = getHandler(errNode.type);
                if (h) await h(errNode, ctx).catch(() => {});
              }
              break;
            }
          }

          if (rowFailed) {
            batchFailed = true;
            break;
          }

          function enableRowOutgoing(nodeId: string) {
            const isCondition = labelOf(nodeId) === "condition";
            const result = Boolean(ctx.outputs[nodeId]?.result);
            for (const e of wf.edges.filter((x) => x.source === nodeId)) {
              let enabled = true;
              if (isCondition) {
                const h = e.sourceHandle;
                if (h === "true") enabled = result;
                else if (h === "false") enabled = !result;
              }
              if (enabled) rowReached.add(e.target);
            }
          }
        }

        ctx.currentRow = undefined;

        if (batchFailed) {
          failed = true;
          break;
        }
      }

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
