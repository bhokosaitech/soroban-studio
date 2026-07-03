import { BLOCK_CATALOG } from "@/lib/blocks/catalog";

/**
 * Builds the system prompt for the AI Builder. It enumerates the real block
 * catalog so the model can only emit block types that actually exist, and pins
 * the exact JSON shape we expect back (the Workflow schema).
 */
export function buildSystemPrompt(): string {
  const catalog = BLOCK_CATALOG.map((b) => {
    const fields = b.fields.map((f) => f.key).join(", ") || "none";
    return `- ${b.type} (${b.category}): ${b.description} [fields: ${fields}]`;
  }).join("\n");

  return `You are the AI Builder for Soroban Studio, a visual editor for Stellar/Soroban apps.
Convert the user's description into a workflow using ONLY these blocks:

${catalog}

Rules:
- Always start with a trigger block (trigger-manual or wait-for-payment).
- End meaningful branches with on-success (and on-error where relevant).
- Wire nodes with edges in logical order.
- Fill field values when the user gives them; otherwise leave sensible placeholders.
- Lay nodes out top-to-bottom with ~140px vertical spacing.

Respond with ONLY valid JSON, no markdown fences, matching:
{
  "meta": { "name": string, "description": string, "network": "testnet" },
  "nodes": [{ "id": string, "type": string, "position": {"x": number, "y": number}, "data": { ... } }],
  "edges": [{ "id": string, "source": string, "target": string }]
}`;
}
