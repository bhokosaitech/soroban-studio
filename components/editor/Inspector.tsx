"use client";

import { useRef } from "react";
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

  if (node.type === "csv-import") {
    return <CSVImportInspector node={node} onClose={() => removeNode(node.id)} />;
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
              network={meta.network}
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
  network,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  network?: "testnet" | "mainnet";
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
    const disabled = Boolean(field.disabledOnMainnet && network === "mainnet");
    const checked = disabled ? false : Boolean(value);
    return (
      <div>
        <label
          className={`flex items-center gap-2 py-1 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-[12px] text-ink">{field.label}</span>
        </label>
        {disabled && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            Not available on mainnet — Friendbot funding is testnet-only.
          </p>
        )}
      </div>
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

/** Custom Inspector for CSV Import block */
function CSVImportInspector({
  node,
  onClose,
}: {
  node: any;
  onClose: () => void;
}) {
  const { updateField } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fields = node.data.fields || {};
  const csvName = fields.csvName || "";
  const rows = fields.rows || [];
  const columns = fields.columns || [];
  const mappings = fields.mappings || {};
  const errors = fields.errors || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const { headers, rows: parsedRows } = parseCSV(text);

      updateField(node.id, "csvName", file.name);
      updateField(node.id, "csvData", text);
      updateField(node.id, "columns", headers);
      updateField(node.id, "rows", parsedRows);

      const errs = validateCSVRows(parsedRows, mappings);
      updateField(node.id, "errors", errs);
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (key: string, column: string) => {
    const nextMappings = { ...mappings, [key]: column };
    updateField(node.id, "mappings", nextMappings);

    const errs = validateCSVRows(rows, nextMappings);
    updateField(node.id, "errors", errs);
  };

  const handleRemove = () => {
    updateField(node.id, "csvName", "");
    updateField(node.id, "csvData", "");
    updateField(node.id, "columns", []);
    updateField(node.id, "rows", []);
    updateField(node.id, "mappings", {});
    updateField(node.id, "errors", []);
  };

  const MAPPABLE_FIELDS = [
    { key: "destination", label: "Recipient Address (destination)" },
    { key: "amount", label: "Amount (amount)" },
    { key: "memo", label: "Memo (memo)" },
    { key: "contractId", label: "Contract ID (contractId)" },
    { key: "address", label: "Watch Address (address)" },
  ];

  return (
    <aside data-guide="inspector" className="flex w-72 shrink-0 flex-col border-l border-border bg-white">
      <div className="flex items-start justify-between border-b border-border p-4">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">CSV Import</h3>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            Upload a CSV file and map its columns to workflow inputs.
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-off hover:text-ink"
          title="Delete block"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* File Uploader */}
        {!csvName ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-accent hover:bg-off transition-all"
          >
            <span className="text-[20px]">📁</span>
            <span className="mt-2 text-[12px] font-medium text-ink">Upload CSV File</span>
            <span className="mt-1 text-[10px] text-muted">Drag & drop or click to browse</span>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-off p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-ink">{csvName}</p>
                <p className="text-[10px] text-muted">{rows.length} rows detected</p>
              </div>
              <button
                onClick={handleRemove}
                className="text-[11px] font-medium text-accent hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Column Mappings */}
        {columns.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Column Mappings</h4>
            {MAPPABLE_FIELDS.map((mf) => (
              <Labeled key={mf.key} label={mf.label}>
                <select
                  value={mappings[mf.key] || ""}
                  onChange={(e) => handleMappingChange(mf.key, e.target.value)}
                  className="input"
                >
                  <option value="">-- Don't Map --</option>
                  {columns.map((col: string) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </Labeled>
            ))}
          </div>
        )}

        {/* Validation Errors */}
        {csvName && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Validation Status</h4>
            {errors.length > 0 ? (
              <div className="rounded-lg border border-accent bg-accent/5 p-3">
                <p className="text-[12px] font-semibold text-accent flex items-center gap-1">
                  <span>❌</span> {errors.length} validation errors
                </p>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1.5 text-[11px] text-muted">
                  {errors.map((err: string, i: number) => (
                    <div key={i} className="leading-snug">
                      • {err}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-green-500 bg-green-500/5 p-3">
                <p className="text-[12px] font-semibold text-green-600 flex items-center gap-1">
                  <span>✅</span> All rows validated successfully!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <style jsx>{inputStyle}</style>
    </aside>
  );
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function isValidStellarAddress(addr: string): boolean {
  const gRegex = /^G[A-D2-7][A-Z2-7]{54}$/;
  const mRegex = /^M[A-D2-7][A-Z2-7]{67}$/;
  return gRegex.test(addr) || mRegex.test(addr);
}

function validateCSVRows(
  rows: Record<string, string>[],
  mappings: Record<string, string>
): string[] {
  const errors: string[] = [];
  const addressCols = ["destination", "address"];
  const numberCols = ["amount"];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1

    // Validate address fields
    for (const addrKey of addressCols) {
      const col = mappings[addrKey];
      if (col) {
        const val = row[col];
        if (!val) {
          errors.push(`Row ${rowNum}: Missing value for '${col}' (mapped to ${addrKey})`);
        } else if (!isValidStellarAddress(val)) {
          errors.push(`Row ${rowNum}: Invalid address '${val}' in column '${col}'`);
        }
      }
    }

    // Validate numeric fields
    for (const numKey of numberCols) {
      const col = mappings[numKey];
      if (col) {
        const val = row[col];
        const numVal = Number(val);
        if (!val) {
          errors.push(`Row ${rowNum}: Missing value for '${col}' (mapped to ${numKey})`);
        } else if (isNaN(numVal) || numVal <= 0) {
          errors.push(`Row ${rowNum}: Invalid amount '${val}' in column '${col}' (must be a positive number)`);
        }
      }
    }
  });

  return errors;
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
