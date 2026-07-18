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

      {def.handles.source &&
        (def.outputs ? (
          <div className="flex border-t border-border">
            {def.outputs.map((o, i) => (
              <div
                key={o.id}
                className="relative flex-1 py-1 text-center text-[10px] font-semibold"
                style={{ color: o.color }}
              >
                {o.label}
                <Handle
                  id={o.id}
                  type="source"
                  position={Position.Bottom}
                  style={{ left: `${((i + 0.5) / def.outputs!.length) * 100}%`, background: o.color }}
                />
              </div>
            ))}
          </div>
        ) : (
          <Handle type="source" position={Position.Bottom} style={{ background: cat.dot }} />
        ))}
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
    case "multisig-wallet": {
      const signers = (f.signers as Array<unknown>) || [];
      const low = f.lowThreshold ?? 1;
      const med = f.mediumThreshold ?? 2;
      const high = f.highThreshold ?? 3;
      return `${signers.length} signer(s) · L:${low} M:${med} H:${high}`;
    }
    case "condition":
      return conditionSummary(f);
    default:
      return "";
  }
}

const OP_SHORT: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", neq: "≠" };
const SUBJECT_SHORT: Record<string, string> = {
  balance: "balance",
  lastAmount: "last amount",
  lastStatus: "last tx",
  custom: "value",
};

function conditionSummary(f: Record<string, unknown>): string {
  const subject = String(f.subject ?? "balance");
  if (subject === "lastStatus") return `last tx ${f.status ?? "succeeded"}?`;
  const subj = SUBJECT_SHORT[subject] ?? "value";
  const op = OP_SHORT[String(f.op ?? "gte")] ?? "";
  const val = f.value ?? "?";
  return `${subj} ${op} ${val}`;
}
