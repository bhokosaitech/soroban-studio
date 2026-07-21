import { defaultData } from "@/lib/blocks/catalog";
import { WORKFLOW_SCHEMA_VERSION, type Workflow } from "@/lib/workflow";

/**
 * Heuristic prompt -> workflow generator.
 *
 * Used when no DEEPSEEK_API_KEY is configured (local dev / demos) and as a
 * safety net if the model returns unparseable output. Keyword-matches the
 * prompt to a sensible chain of blocks so the AI Builder always produces
 * something runnable.
 */
export function heuristicWorkflow(prompt: string): Workflow {
  const p = prompt.toLowerCase();
  const chain: string[] = [];

  // Trigger
  chain.push(p.includes("when paid") || p.includes("receive") ? "wait-for-payment" : "trigger-manual");

  if (p.includes("multisig") || p.includes("multi-sig") || p.includes("multi signature"))
    chain.push("multisig-wallet");
  else if (p.includes("wallet") || p.includes("account") || p.includes("sign up"))
    chain.push("create-wallet");
  if (p.includes("connect")) chain.push("connect-wallet");
  if (p.includes("invoice") || p.includes("bill")) chain.push("create-invoice");
  if (p.includes("trustline") || p.includes("usdc") || p.includes("token"))
    chain.push("establish-trustline");
  if (p.includes("pool") || p.includes("liquidity") || p.includes("amm") || p.includes("lp"))
    chain.push("liquidity-pool");
  if (p.includes("swap") || p.includes("exchange")) chain.push("swap-asset");
  if (p.includes("private") || p.includes("shielded") || p.includes("confidential"))
    chain.push("confidential-transfer");
  else if (p.includes("pay") || p.includes("send") || p.includes("transfer"))
    chain.push("send-payment");
  if (p.includes("contract") || p.includes("invoke")) chain.push("invoke-contract");
  if (p.includes("verify") || p.includes("confirm")) chain.push("verify-transaction");
  if (p.includes("webhook") || p.includes("notify") || p.includes("callback"))
    chain.push("trigger-webhook");

  // Ensure there's at least one action beyond the trigger.
  if (chain.length === 1) chain.push("send-payment");
  chain.push("on-success");

  const nodes = chain.map((type, i) => ({
    id: `n${i + 1}`,
    type,
    position: { x: 260, y: 60 + i * 140 },
    data: defaultData(type),
  }));

  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `e${i + 1}`,
    source: n.id,
    target: nodes[i + 1].id,
  }));

  return {
    version: WORKFLOW_SCHEMA_VERSION,
    meta: {
      name: titleFrom(prompt),
      description: prompt.trim().slice(0, 160),
      network: "testnet",
    },
    nodes,
    edges,
  };
}

function titleFrom(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : "AI workflow";
}
