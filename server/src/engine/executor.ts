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
 * Execute a workflow against real Stellar testnet, sequentially in topological
 * order. Streams every step via `emit`. Stops at the first failing step and
 * runs on-error terminals so the user gets a clean signal.
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
  let failed = false;

  for (const node of order) {
    const handler = getHandler(node.type);
    if (!handler) {
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "warn", message: `No handler for "${node.type}" — skipped.` });
      continue;
    }
    // Error terminals only run after a failure.
    if (node.type === "on-error" && !failed) continue;
    if (node.type === "on-success" && failed) continue;

    try {
      await handler(node, ctx);
    } catch (e) {
      failed = true;
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "error",
        message: (e as Error).message ?? "Step failed.",
      });
      // Run any on-error terminals, then stop.
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
}
