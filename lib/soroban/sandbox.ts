import { getBlock } from "@/lib/blocks/catalog";
import { applyLoopVars, executionOrder, resolveLoopItems, type Workflow, type WorkflowNode } from "@/lib/workflow";
import { getNetwork, type NetworkConfig } from "./config";

/**
 * Sandbox execution runtime (simulated).
 *
 * This walks the workflow in topological order and emits a log line per block,
 * mimicking what a live testnet run would produce. It is intentionally a
 * simulation for now: it exercises the full editor -> workflow -> runtime path
 * without spending test XLM or requiring a signer, and gives us the log-stream
 * UI. Swapping in real @stellar/stellar-sdk calls happens block-by-block behind
 * this same interface.
 */

export type LogLevel = "info" | "success" | "error" | "network" | "warn";

export interface RunLog {
  nodeId: string;
  blockType: string;
  level: LogLevel;
  message: string;
  at: number;
}

export interface RunResult {
  ok: boolean;
  logs: RunLog[];
}

function fakeHash(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("") + "…";
}

export async function runSandbox(
  wf: Workflow,
  onLog?: (log: RunLog) => void
): Promise<RunResult> {
  const net = getNetwork(wf.meta.network);
  const logs: RunLog[] = [];
  const push = (log: RunLog) => {
    logs.push(log);
    onLog?.(log);
  };

  push({
    nodeId: "runtime",
    blockType: "runtime",
    level: "info",
    message: `Starting run on ${net.label} (${net.sorobanRpcUrl})`,
    at: Date.now(),
  });

  // A Loop / Batch node repeats the single node connected after it; that node
  // is simulated inside the loop below, not as a standalone step here.
  const loopOwnerOf = new Map<string, WorkflowNode>();
  for (const n of wf.nodes) {
    if (n.type !== "loop-batch") continue;
    const bodyEdge = wf.edges.find((e) => e.source === n.id);
    if (bodyEdge) loopOwnerOf.set(bodyEdge.target, n);
  }

  for (const node of executionOrder(wf)) {
    if (loopOwnerOf.has(node.id)) continue;

    const def = getBlock(node.type);
    if (!def) continue;

    if (node.type === "loop-batch") {
      const bodyEdge = wf.edges.find((e) => e.source === node.id);
      const bodyNode = bodyEdge ? wf.nodes.find((n) => n.id === bodyEdge.target) : undefined;
      await runLoopBatchSim(node, bodyNode, net, push);
      continue;
    }

    // Simulate latency for network blocks.
    if (def.network) await new Promise((r) => setTimeout(r, 250));

    const detail = describeStep(node.type, node.data, net);
    push({
      nodeId: node.id,
      blockType: node.type,
      level: def.network ? "network" : "info",
      message: `${def.label}: ${detail}`,
      at: Date.now(),
    });

    if (def.network) {
      push({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `  ↳ tx ${fakeHash()} confirmed`,
        at: Date.now(),
      });
    }
  }

  push({
    nodeId: "runtime",
    blockType: "runtime",
    level: "success",
    message: "Run complete.",
    at: Date.now(),
  });

  return { ok: true, logs };
}

/** Simulated Loop / Batch: describes the connected body step once per iteration. */
async function runLoopBatchSim(
  loopNode: WorkflowNode,
  bodyNode: WorkflowNode | undefined,
  net: NetworkConfig,
  push: (log: RunLog) => void
) {
  const items = resolveLoopItems(loopNode.data);

  if (!bodyNode) {
    push({
      nodeId: loopNode.id,
      blockType: loopNode.type,
      level: "warn",
      message: "Loop / Batch has no step connected after it — nothing to repeat.",
      at: Date.now(),
    });
    return;
  }

  const bodyDef = getBlock(bodyNode.type);
  if (!bodyDef) return;

  push({
    nodeId: loopNode.id,
    blockType: loopNode.type,
    level: "info",
    message: `Loop / Batch: ${items.length} iteration(s) of "${bodyDef.label}".`,
    at: Date.now(),
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const data = applyLoopVars(bodyNode.data, { item, index: i });
    if (bodyDef.network) await new Promise((r) => setTimeout(r, 120));

    push({
      nodeId: bodyNode.id,
      blockType: bodyNode.type,
      level: bodyDef.network ? "network" : "info",
      message: `  [${i + 1}/${items.length}] ${bodyDef.label}: ${describeStep(bodyNode.type, data, net)}`,
      at: Date.now(),
    });
    if (bodyDef.network) {
      push({
        nodeId: bodyNode.id,
        blockType: bodyNode.type,
        level: "success",
        message: `    ↳ tx ${fakeHash()} confirmed`,
        at: Date.now(),
      });
    }
  }

  push({
    nodeId: loopNode.id,
    blockType: loopNode.type,
    level: "success",
    message: `Loop complete — ${items.length} iteration(s).`,
    at: Date.now(),
  });
}

function describeStep(type: string, data: Record<string, unknown>, net: NetworkConfig): string {
  switch (type) {
    case "create-wallet":
      return data.fund && net.friendbotUrl
        ? "generating keypair + funding via Friendbot"
        : net.friendbotUrl
          ? "generating keypair"
          : "generating keypair (fund manually — no Friendbot on mainnet)";
    case "send-payment":
      return `sending ${data.amount ?? "?"} ${data.asset ?? "XLM"} → ${short(data.destination)}`;
    case "confidential-transfer":
      return `encrypted transfer of ${data.amount ?? "?"} via ${short(data.contractId)}`;
    case "invoke-contract":
      return `${short(data.contractId)}.${data.method ?? "?"}()`;
    case "wait-for-payment":
      return `watching ${short(data.address)} for ${data.amount ?? "any"} ${data.asset ?? "XLM"}`;
    case "create-invoice":
      return `generating ${data.amount ?? "?"} ${data.asset ?? ""} invoice`;
    case "swap-asset":
      return `analyzing ${data.amount ?? "?"} ${String(data.sendAsset ?? "XLM")} → ${String(data.destAsset ?? "USDC")}`;
    case "trigger-webhook":
      return `${data.method ?? "POST"} ${data.url ?? "?"}`;
    case "multisig-wallet":
      const signers = data.signers as Array<{ publicKey: string; weight: number }> || [];
      return `configuring ${signers.length} signer(s) with thresholds (low: ${data.lowThreshold ?? 1}, med: ${data.mediumThreshold ?? 2}, high: ${data.highThreshold ?? 3})`;
    default:
      return "ok";
  }
}

function short(v: unknown): string {
  const s = String(v ?? "—");
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
