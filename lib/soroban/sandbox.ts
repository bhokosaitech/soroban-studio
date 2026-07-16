import { getBlock } from "@/lib/blocks/catalog";
import { executionOrder, type Workflow, getDownstreamNodeIds } from "@/lib/workflow";
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

  const csvNode = wf.nodes.find((n) => n.type === "csv-import");
  const downstreamIds = csvNode ? getDownstreamNodeIds(wf, csvNode.id) : new Set<string>();

  for (const node of executionOrder(wf)) {
    if (downstreamIds.has(node.id)) {
      // Executed inside the csv-import loop below
      continue;
    }

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

    if (node.type === "csv-import") {
      const rows = (node.data?.rows as any[]) || [];
      const mappings = (node.data?.mappings as Record<string, string>) || {};

      if (rows.length === 0) {
        push({
          nodeId: node.id,
          blockType: node.type,
          level: "warn",
          message: "CSV Import: No rows to process.",
          at: Date.now(),
        });
        continue;
      }

      push({
        nodeId: node.id,
        blockType: node.type,
        level: "info",
        message: `CSV Import: Starting simulated batch processing of ${rows.length} rows.`,
        at: Date.now(),
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        push({
          nodeId: node.id,
          blockType: node.type,
          level: "info",
          message: `--- [Simulated] Processing row ${i + 1} of ${rows.length} ---`,
          at: Date.now(),
        });

        // Map row to simulated step inputs
        const mappedRow: Record<string, any> = {};
        for (const [wfKey, csvCol] of Object.entries(mappings)) {
          if (csvCol && row[csvCol] !== undefined) {
            mappedRow[wfKey] = row[csvCol];
          }
        }

        const downstreamNodes = executionOrder(wf).filter((n) => downstreamIds.has(n.id));
        for (const dsNode of downstreamNodes) {
          const dsDef = getBlock(dsNode.type);
          if (!dsDef) continue;

          // Override node.data with mapped row fields for description
          const simulatedData = { ...dsNode.data };
          for (const key of Object.keys(simulatedData)) {
            if (mappedRow[key] !== undefined) {
              simulatedData[key] = mappedRow[key];
            }
          }

          if (dsDef.network) await new Promise((r) => setTimeout(r, 100));

          const dsDetail = describeStep(dsNode.type, simulatedData, net);
          push({
            nodeId: dsNode.id,
            blockType: dsNode.type,
            level: dsDef.network ? "network" : "info",
            message: `${dsDef.label}: ${dsDetail}`,
            at: Date.now(),
          });

          if (dsDef.network) {
            push({
              nodeId: dsNode.id,
              blockType: dsNode.type,
              level: "success",
              message: `  ↳ tx ${fakeHash()} confirmed`,
              at: Date.now(),
            });
          }
        }
      }
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
    case "csv-import":
      return `reading CSV dataset with ${(data.rows as any[])?.length ?? 0} rows`;
    default:
      return "ok";
  }
}

function short(v: unknown): string {
  const s = String(v ?? "—");
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
