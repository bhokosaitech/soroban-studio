"use client";

import { getBlock } from "@/lib/blocks/catalog";
import type { BlockField } from "@/lib/blocks/types";
import { ASSET_OPTIONS } from "@/lib/blocks/assets";
import { useEditorStore } from "@/lib/store/editor";
import { useVaultStore } from "@/lib/vault/store";
import { Trash2 } from "lucide-react";

/**
 * Right-hand inspector — edits the selected node's fields (from the catalog)
 * and shows workflow-level meta when nothing is selected.
 */
export function Inspector() {
  const { nodes, selectedId, updateField, removeNode, meta, setMeta } = useEditorStore();
  const node = nodes.find((n) => n.id === selectedId);

  if (!node) {
    return (
      <aside data-guide="inspector" className="w-72 shrink-0 border-l border-border bg-white p-4">
        <h3 className="text-[13px] font-semibold text-ink">Workflow</h3>
        <p className="mt-1 text-[12px] text-muted">
          Select a block to edit it, or configure the workflow below.
        </p>
        <div className="mt-4 space-y-3">
          <Labeled label="Name">
            <input
              value={meta.name}
              onChange={(e) => setMeta({ name: e.target.value })}
              className="input"
            />
          </Labeled>
          <Labeled label="Network">
            <select
              value={meta.network}
              onChange={(e) => setMeta({ network: e.target.value as "testnet" | "mainnet" })}
              className="input"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </Labeled>
        </div>
        <style jsx>{inputStyle}</style>
      </aside>
    );
  }

  const def = getBlock(node.type ?? "");
  if (!def) return null;
  const fields = node.data.fields as Record<string, unknown>;

  return (
    <aside data-guide="inspector" className="flex w-72 shrink-0 flex-col border-l border-border bg-white">
      <div className="flex items-start justify-between border-b border-border p-4">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">{def.label}</h3>
          <p className="mt-1 text-[12px] leading-snug text-muted">{def.description}</p>
        </div>
        <button
          onClick={() => removeNode(node.id)}
          className="ml-2 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-off hover:text-ink"
          title="Delete block"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {def.fields.length === 0 && (
          <p className="text-[12px] text-muted">This block has no configuration.</p>
        )}
        {def.fields
          .filter((field) => {
            if (!field.showIf) return true;
            const current = String(fields[field.showIf.field] ?? "");
            return field.showIf.in.includes(current);
          })
          .map((field) => (
            <Field
              key={field.key}
              field={field}
              value={fields[field.key]}
              onChange={(v) => updateField(node.id, field.key, v)}
            />
          ))}
      </div>
      <style jsx>{inputStyle}</style>
    </aside>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span>
      {field.label}
      {field.required && <span className="text-accent"> *</span>}
    </span>
  );

  if (field.type === "wallet") {
    return <WalletField field={field} value={value} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-[12px] text-ink">{field.label}</span>
      </label>
    );
  }

  if (field.type === "select" || field.type === "asset") {
    const options = field.type === "asset" ? ASSET_OPTIONS : field.options ?? [];
    return (
      <Labeled label={label} help={field.help}>
        <select
          value={String(value ?? field.default ?? options[0]?.value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Labeled>
    );
  }

  const inputType =
    field.type === "number" ? "number" : field.type === "secret" ? "password" : "text";

  return (
    <Labeled label={label} help={field.help}>
      <input
        type={inputType}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        autoComplete={field.type === "secret" ? "off" : undefined}
        onChange={(e) =>
          onChange(field.type === "number" ? e.target.valueAsNumber || "" : e.target.value)
        }
        className="input"
      />
    </Labeled>
  );
}

/** Dropdown of vault wallets for `wallet`-type fields. */
function WalletField({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { wallets, unlocked, initialized } = useVaultStore();

  const label = (
    <span>
      {field.label}
      {field.required && <span className="text-accent"> *</span>}
    </span>
  );

  if (!initialized || !unlocked) {
    return (
      <Labeled label={label} help={field.help}>
        <div className="rounded-lg border border-dashed border-border bg-off px-3 py-2 text-[12px] text-muted">
          {initialized ? "Unlock" : "Create"} your wallet vault (top bar) to pick a saved wallet.
        </div>
      </Labeled>
    );
  }

  if (wallets.length === 0) {
    return (
      <Labeled label={label} help={field.help}>
        <div className="rounded-lg border border-dashed border-border bg-off px-3 py-2 text-[12px] text-muted">
          No saved wallets yet — add one in the vault.
        </div>
      </Labeled>
    );
  }

  return (
    <Labeled label={label} help={field.help}>
      <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">Select a wallet…</option>
        {wallets.map((w) => (
          <option key={w.publicKey} value={w.publicKey}>
            {w.label ? `${w.label} — ` : ""}
            {w.publicKey.slice(0, 6)}…{w.publicKey.slice(-4)}
          </option>
        ))}
      </select>
      <style jsx>{inputStyle}</style>
    </Labeled>
  );
}

function Labeled({
  label,
  help,
  children,
}: {
  label: React.ReactNode;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-ink">{label}</label>
      {children}
      {help && <p className="mt-1 text-[11px] leading-snug text-muted">{help}</p>}
    </div>
  );
}

const inputStyle = `
  .input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 13px;
    background: var(--white);
    color: var(--ink);
    outline: none;
  }
  .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
`;
