import { defaultData } from "@/lib/blocks/catalog";
import { WORKFLOW_SCHEMA_VERSION, type Workflow } from "@/lib/workflow";

/**
 * Starter templates surfaced on the dashboard. Each is a real, loadable
 * Workflow built from catalog blocks — selecting one seeds the editor.
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  tags: string[];
  blocks: string[]; // ordered chain of block types
}

export const TEMPLATES: Template[] = [
  {
    id: "wallet-payment",
    name: "Wallet + Payment",
    description: "Create a funded wallet and send a payment — the classic first app.",
    tags: ["wallet", "payment"],
    blocks: ["trigger-manual", "create-wallet", "send-payment", "on-success"],
  },
  {
    id: "invoice-checkout",
    name: "Invoice Checkout",
    description: "Issue an invoice, wait for payment, verify, then fire a webhook.",
    tags: ["payments", "automation"],
    blocks: [
      "trigger-manual",
      "create-invoice",
      "wait-for-payment",
      "verify-transaction",
      "trigger-webhook",
      "on-success",
    ],
  },
  {
    id: "confidential-transfer",
    name: "Confidential Transfer",
    description: "Move value privately with an encrypted-balance Soroban token contract.",
    tags: ["privacy", "contract"],
    blocks: ["trigger-manual", "connect-wallet", "confidential-transfer", "verify-transaction", "on-success"],
  },
  {
    id: "contract-call",
    name: "Contract Interaction",
    description: "Connect a wallet and invoke a function on a deployed Soroban contract.",
    tags: ["contract"],
    blocks: ["trigger-manual", "connect-wallet", "invoke-contract", "on-success"],
  },
  {
    id: "token-creation",
    name: "Token Creation",
    description: "Deploy a new Soroban token contract and initialize it.",
    tags: ["token", "contract"],
    blocks: ["trigger-manual", "connect-wallet", "deploy-contract", "invoke-contract", "on-success"],
  },
  {
    id: "nft-marketplace",
    name: "NFT Marketplace",
    description: "List an NFT, wait for a buyer's payment, and execute the transfer.",
    tags: ["nft", "marketplace"],
    blocks: ["trigger-manual", "connect-wallet", "invoke-contract", "wait-for-payment", "invoke-contract", "on-success"],
  },
  {
    id: "escrow-payment",
    name: "Escrow Payment",
    description: "Hold funds in escrow, check condition, and either release or refund.",
    tags: ["escrow", "payment", "contract"],
    blocks: ["wait-for-payment", "condition", "invoke-contract", "on-success"],
  },
  {
    id: "payment-processor",
    name: "Payment Processor",
    description: "Generate an invoice, verify incoming payment, and alert your backend via webhook.",
    tags: ["payments", "automation"],
    blocks: ["create-invoice", "wait-for-payment", "verify-transaction", "trigger-webhook", "on-success"],
  },
  {
    id: "subscription-payment",
    name: "Subscription Payment",
    description: "Trigger recurring payments on a schedule with a loop and delay.",
    tags: ["subscription", "payment", "automation"],
    blocks: ["trigger-manual", "connect-wallet", "send-payment", "delay", "loop-batch", "on-success"],
  },
  {
    id: "dao-governance",
    name: "DAO Governance",
    description: "Register a vote, check if the proposal passes, and execute the decision.",
    tags: ["dao", "governance", "contract"],
    blocks: ["trigger-manual", "connect-wallet", "invoke-contract", "condition", "invoke-contract", "on-success"],
  },
  {
    id: "token-vesting",
    name: "Token Vesting",
    description: "Deploy a vesting contract, wait for the cliff/delay, and claim vested tokens.",
    tags: ["token", "vesting", "automation"],
    blocks: ["trigger-manual", "connect-wallet", "deploy-contract", "delay", "invoke-contract", "on-success"],
  },
];

export function templateToWorkflow(t: Template): Workflow {
  const nodes = t.blocks.map((type, i) => ({
    id: `n${i + 1}`,
    type,
    position: { x: 300, y: 60 + i * 130 },
    data: defaultData(type),
  }));
  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `e${i + 1}`,
    source: n.id,
    target: nodes[i + 1].id,
  }));
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    meta: { name: t.name, description: t.description, network: "testnet" },
    nodes,
    edges,
  };
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
