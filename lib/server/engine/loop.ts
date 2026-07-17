/**
 * Server-side mirror of the Loop / Batch helpers (see lib/workflow/loop.ts for
 * the client-side twin) — kept in this module rather than shared to stay
 * consistent with workflow-schema.ts's server/client schema split.
 */

const MAX_ITERATIONS = 200;

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
