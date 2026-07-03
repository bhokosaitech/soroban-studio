import { WORKFLOW_SCHEMA_VERSION, type Workflow } from "@/lib/workflow";
import { buildSystemPrompt } from "./prompt";
import { heuristicWorkflow } from "./fallback";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

/**
 * Server-side workflow generation.
 *
 * With DEEPSEEK_API_KEY set, calls DeepSeek and validates/normalizes the JSON.
 * Without a key (or on any failure), falls back to the local heuristic so the
 * feature never hard-fails during development or demos.
 */
export async function generateWorkflow(
  prompt: string
): Promise<{ workflow: Workflow; source: "deepseek" | "heuristic" }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return { workflow: heuristicWorkflow(prompt), source: "heuristic" };
  }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content) as Partial<Workflow>;
    return { workflow: normalize(parsed, prompt), source: "deepseek" };
  } catch {
    // Graceful degradation — never block the user on the model.
    return { workflow: heuristicWorkflow(prompt), source: "heuristic" };
  }
}

/** Coerce a model response into a valid Workflow, filling gaps. */
function normalize(input: Partial<Workflow>, prompt: string): Workflow {
  if (!input.nodes?.length) return heuristicWorkflow(prompt);
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    meta: {
      name: input.meta?.name ?? "AI workflow",
      description: input.meta?.description ?? prompt.slice(0, 160),
      network: input.meta?.network === "mainnet" ? "mainnet" : "testnet",
    },
    nodes: input.nodes.map((n, i) => ({
      id: n.id ?? `n${i + 1}`,
      type: n.type ?? "trigger-manual",
      position: n.position ?? { x: 260, y: 60 + i * 140 },
      data: n.data ?? {},
    })),
    edges: (input.edges ?? []).map((e, i) => ({
      id: e.id ?? `e${i + 1}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label,
    })),
  };
}
