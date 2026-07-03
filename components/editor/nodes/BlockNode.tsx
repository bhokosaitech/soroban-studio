"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATEGORY_META, getBlock } from "@/lib/blocks/catalog";
import { Icon } from "../Icon";

/**
 * A single generic node renderer, driven entirely by the block catalog.
 * The React Flow `type` is the block type, so every catalog entry gets this
 * component (registered once in the editor page).
 */
export function BlockNode({ type, data, selected }: NodeProps) {
  const def = getBlock(type ?? "");
  if (!def) return null;

  const cat = CATEGORY_META[def.category];
  const fields = (data as { fields?: Record<string, unknown> })?.fields ?? {};
  const summary = summarize(def.type, fields);

  return (
    <div
      className="rounded-[10px] border bg-white shadow-sm transition-shadow"
      style={{
        borderColor: selected ? cat.dot : "var(--border)",
        boxShadow: selected ? `0 0 0 2px ${cat.dot}22` : undefined,
        width: 200,
      }}
    >
      {def.handles.target && (
        <Handle type="target" position={Position.Top} style={{ background: cat.dot }} />
      )}

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${cat.dot}14`, color: cat.dot }}
        >
          <Icon name={def.icon} size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{def.label}</div>
          <div className="truncate text-[11px] text-muted">
            {summary || cat.label}
          </div>
        </div>
      </div>

      {def.handles.source && (
        <Handle type="source" position={Position.Bottom} style={{ background: cat.dot }} />
      )}
    </div>
  );
}

/** A short one-line description of the node's most important field. */
function summarize(type: string, f: Record<string, unknown>): string {
  switch (type) {
    case "send-payment":
      return f.amount ? `${f.amount} ${f.asset ?? "XLM"}` : "";
    case "invoke-contract":
      return f.method ? `${f.method}()` : "";
    case "wait-for-payment":
      return f.amount ? `≥ ${f.amount} ${f.asset ?? "XLM"}` : "";
    case "trigger-webhook":
      return typeof f.url === "string" ? f.url.replace(/^https?:\/\//, "") : "";
    case "create-invoice":
      return f.amount ? `${f.amount} ${f.asset ?? ""}` : "";
    default:
      return "";
  }
}
