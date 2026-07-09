import { getBlock } from "@/lib/blocks/catalog";
import { executionOrder, type Workflow } from "@/lib/workflow";
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

  for (const node of executionOrder(wf)) {
    const def = getBlock(node.type);
    if (!def) continue;

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
    case "trigger-webhook":
      return `${data.method ?? "POST"} ${data.url ?? "?"}`;
    default:
      return "ok";
  }
}

function short(v: unknown): string {
  const s = String(v ?? "—");
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
