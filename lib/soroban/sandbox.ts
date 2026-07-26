import { getBlock } from "@/lib/blocks/catalog";
import { applyLoopVars, executionOrder, resolveLoopItems, getDownstreamNodeIds, type Workflow, type WorkflowNode } from "@/lib/workflow";
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

  const csvNode = wf.nodes.find((n) => n.type === "csv-import");
  const downstreamIds = csvNode ? getDownstreamNodeIds(wf, csvNode.id) : new Set<string>();

  for (const node of executionOrder(wf)) {
    if (loopOwnerOf.has(node.id)) continue;
    if (downstreamIds.has(node.id)) continue;

    const def = getBlock(node.type);
    if (!def) continue;

    if (node.type === "loop-batch") {
      const bodyEdge = wf.edges.find((e) => e.source === node.id);
      const bodyNode = bodyEdge ? wf.nodes.find((n) => n.id === bodyEdge.target) : undefined;
      await runLoopBatchSim(node, bodyNode, net, push);
      continue;
    }

    if (node.type === "deploy-contract") {
      const wasmFile = (node.data.wasm as { filename?: string })?.filename ?? "contract.wasm";
      const deployNetwork = String(node.data.network ?? "testnet");
      
      push({
        nodeId: node.id,
        blockType: node.type,
        level: "info",
        message: `Deploy Contract: Uploading WASM "${wasmFile}" on ${deployNetwork}…`,
        at: Date.now(),
      });
      await new Promise((r) => setTimeout(r, 200));
      push({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `  ↳ Upload WASM confirmed. Hash: ${fakeHash()}`,
        at: Date.now(),
      });
      push({
        nodeId: node.id,
        blockType: node.type,
        level: "info",
        message: "Deploy Contract: Instantiating contract instance…",
        at: Date.now(),
      });
      await new Promise((r) => setTimeout(r, 200));
      const simulatedContractId = "C" + Array.from({ length: 55 }, () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".charAt(Math.floor(Math.random() * 32))
      ).join("");
      push({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `  ↳ Instantiate Contract confirmed. Hash: ${fakeHash()}`,
        at: Date.now(),
      });
      push({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Contract successfully deployed! ID: ${simulatedContractId}`,
        at: Date.now(),
      });
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
    case "deploy-contract":
      const wasmFile = (data.wasm as { filename?: string })?.filename ?? "contract.wasm";
      return `deploying Soroban contract "${wasmFile}" on ${String(data.network ?? "testnet")}`;
    case "wait-for-payment":
      return `watching ${short(data.address)} for ${data.amount ?? "any"} ${data.asset ?? "XLM"}`;
    case "create-invoice":
      return `generating ${data.amount ?? "?"} ${data.asset ?? ""} invoice`;
    case "swap-asset":
      return `analyzing ${data.amount ?? "?"} ${String(data.sendAsset ?? "XLM")} → ${String(data.destAsset ?? "USDC")}`;
    case "trigger-webhook":
      return `${data.method ?? "POST"} ${data.url ?? "?"}`;
    case "csv-import":
      return `reading CSV dataset with ${(data.rows as any[])?.length ?? 0} rows`;
    case "multisig-wallet": {
      const signers = (data.signers as Array<{ publicKey: string; weight: number }>) || [];
      return `configuring ${signers.length} signer(s) with thresholds (low: ${data.lowThreshold ?? 1}, med: ${data.mediumThreshold ?? 2}, high: ${data.highThreshold ?? 3})`;
    }
    case "liquidity-pool": {
      const act = data.action ?? "deposit";
      const pair = `${data.assetA ?? "XLM"}/${data.assetB ?? "USDC"}`;
      if (act === "deposit")
        return `depositing liquidity (${data.amountA ?? "max"} ${data.assetA ?? "XLM"} + ${data.amountB ?? "max"} ${data.assetB ?? "USDC"}) into ${pair} pool`;
      if (act === "withdraw")
        return `withdrawing ${data.shares ?? "all"} LP shares from ${pair} pool`;
      return `fetching liquidity pool info for ${pair}`;
    }
    default:
      return "ok";
  }
}

function short(v: unknown): string {
  const s = String(v ?? "—");
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
