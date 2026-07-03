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
