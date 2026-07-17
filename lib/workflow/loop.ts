/**
 * Helpers shared by the server executor and the client sandbox for the
 * Loop / Batch block, which repeats the single node connected after it.
 */

const MAX_ITERATIONS = 200;

/** Parse a Loop / Batch "items" field into a flat list of strings. */
export function parseLoopItems(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.map((v) => String(v)).slice(0, MAX_ITERATIONS);
    } catch {
      // fall through to plain-text splitting
    }
  }
  return trimmed
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ITERATIONS);
}

/** Resolve a Loop / Batch node's data into the concrete list of iterations to run. */
export function resolveLoopItems(data: Record<string, unknown>): string[] {
  if (data.mode === "list") {
    // The inspector stores `items` as a string[] (one per row); older/imported
    // workflows may still carry a comma/newline-separated string.
    if (Array.isArray(data.items)) {
      return data.items
        .map((v) => String(v).trim())
        .filter(Boolean)
        .slice(0, MAX_ITERATIONS);
    }
    return parseLoopItems(String(data.items ?? ""));
  }
  const count = Math.max(0, Math.min(Math.trunc(Number(data.count) || 0), MAX_ITERATIONS));
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

/** Substitute {{item}} / {{index}} placeholders into a node's string field values. */
export function applyLoopVars(
  data: Record<string, unknown>,
  vars: { item: string; index: number }
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] =
      typeof value === "string"
        ? value.replace(/\{\{\s*item\s*\}\}/g, vars.item).replace(/\{\{\s*index\s*\}\}/g, String(vars.index))
        : value;
  }
  return out;
}
