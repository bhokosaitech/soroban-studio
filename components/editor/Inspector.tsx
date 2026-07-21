"use client";

import { getBlock } from "@/lib/blocks/catalog";
import type { BlockField } from "@/lib/blocks/types";
import { ASSET_OPTIONS } from "@/lib/blocks/assets";
import { useEditorStore } from "@/lib/store/editor";
import { useVaultStore } from "@/lib/vault/store";
import { Trash2, Plus, X, RefreshCw, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useCallback, useRef } from "react";

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
        {def.type === "multisig-wallet" && (() => {
          const low = Number(fields.lowThreshold ?? 1);
          const med = Number(fields.mediumThreshold ?? 2);
          const high = Number(fields.highThreshold ?? 3);
          const signers = (fields.signers as Array<{ publicKey: string; weight: number }>) || [];
          const totalWeight = signers.reduce((acc, s) => acc + (Number(s.weight) || 0), 1);
          const err =
            low > med || med > high
              ? "Threshold rule violated: Low ≤ Medium ≤ High required."
              : totalWeight < high
              ? `Total signer weight (${totalWeight}) is less than High threshold (${high}). Account could be locked.`
              : null;
          if (!err) return null;
          return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] leading-relaxed text-red-700">
              ⚠️ {err}
            </div>
          );
        })()}
        {def.type === "swap-asset" && (
          <SwapQuotePanel fields={fields} network={meta.network} />
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

  if (field.type === "list") {
    return <ListField field={field} value={value} onChange={onChange} />;
  }

  if (field.type === "signers") {
    return <SignersField field={field} value={value} onChange={onChange} />;
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

/** Dynamic add/remove rows for `list`-type fields (one input per item). */
function ListField({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const items = Array.isArray(value) ? (value as string[]) : [];

  const label = (
    <span>
      {field.label}
      {field.required && <span className="text-accent"> *</span>}
    </span>
  );

  function setItem(i: number, v: string) {
    const next = [...items];
    next[i] = v;
    onChange(next);
  }

  function removeItem(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <Labeled label={label} help={field.help}>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={item}
              placeholder={field.placeholder}
              onChange={(e) => setItem(i, e.target.value)}
              className="input"
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-off hover:text-ink"
              title="Remove"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
        >
          <Plus size={13} /> Add value
        </button>
      </div>
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

/** Signers configuration for multisig wallets. */
interface Signer {
  publicKey: string;
  weight: number;
}

function SignersField({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const signers = (value as Signer[]) || [];
  const [newPublicKey, setNewPublicKey] = useState("");
  const [newWeight, setNewWeight] = useState(1);
  const [keyError, setKeyError] = useState<string | null>(null);

  const label = (
    <span>
      {field.label}
      {field.required && <span className="text-accent"> *</span>}
    </span>
  );

  const isValidStellarKey = (key: string) => /^G[A-Z2-7]{55}$/.test(key);

  const addSigner = () => {
    const key = newPublicKey.trim();
    if (!key) return;
    if (!isValidStellarKey(key)) {
      setKeyError("Invalid Stellar public key (must start with G, 56 chars).");
      return;
    }
    setKeyError(null);
    const updated = [...signers, { publicKey: key, weight: Math.min(255, Math.max(1, newWeight)) }];
    onChange(updated);
    setNewPublicKey("");
    setNewWeight(1);
  };

  const removeSigner = (index: number) => {
    const updated = signers.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateSigner = (index: number, key: keyof Signer, val: string | number) => {
    const updated = [...signers];
    if (key === "weight") {
      val = Math.min(255, Math.max(0, parseInt(String(val)) || 0));
    }
    updated[index] = { ...updated[index], [key]: val };
    onChange(updated);
  };

  return (
    <Labeled label={label} help={field.help}>
      <div className="space-y-2">
        {signers.map((signer, index) => (
          <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-off p-2">
            <input
              type="text"
              value={signer.publicKey}
              onChange={(e) => updateSigner(index, "publicKey", e.target.value)}
              placeholder="G..."
              className="input min-w-0 flex-1 text-[11px] font-mono"
            />
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[11px] font-medium text-muted">W:</span>
              <input
                type="number"
                value={signer.weight}
                onChange={(e) => updateSigner(index, "weight", e.target.value)}
                min="0"
                max="255"
                className="input w-12 px-1 text-center text-[11px]"
              />
            </div>
            <button
              type="button"
              onClick={() => removeSigner(index)}
              className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-white hover:text-red-600"
              title="Remove signer"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <div className="space-y-2 rounded-lg border border-dashed border-border bg-off p-2.5">
          <input
            type="text"
            value={newPublicKey}
            onChange={(e) => {
              setNewPublicKey(e.target.value);
              if (keyError) setKeyError(null);
            }}
            placeholder="Add signer public key (G...)..."
            className="input w-full min-w-0 text-[11px] font-mono"
          />
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">Weight:</span>
              <input
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(parseInt(e.target.value) || 1)}
                min="1"
                max="255"
                className="input w-14 px-1 text-center text-[11px]"
              />
            </div>
            <button
              type="button"
              onClick={addSigner}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <Plus size={13} /> Add Signer
            </button>
          </div>
        </div>

        {keyError && <p className="text-[11px] font-medium text-red-500">{keyError}</p>}
      </div>
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

// ---------------------------------------------------------------------------
// Swap Quote Panel — live preview for the swap-asset block
// ---------------------------------------------------------------------------

interface SwapQuoteResult {
  expectedReceive: string;
  sendAmountMin: string;
  route: string;
  slippageBps: number;
  priceImpactPct?: number;
}

/**
 * Renders a "Preview Quote" button that fetches a real-time Horizon path-finding
 * quote and displays: estimated receive, minimum received after slippage, route,
 * price impact, estimated fee, and a liquidity warning banner.
 */
function SwapQuotePanel({
  fields,
  network,
}: {
  fields: Record<string, unknown>;
  network?: "testnet" | "mainnet";
}) {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<SwapQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendAsset = String(fields.sendAsset ?? "XLM");
  const destAsset = String(fields.destAsset ?? "USDC");
  const amount = Number(fields.amount ?? 0);
  const slippageBps = Number(fields.slippageBps ?? 100);
  const mode = String(fields.mode ?? "exact-in");

  // Validation before fetching.
  const validationError =
    sendAsset.toUpperCase() === destAsset.toUpperCase()
      ? "Input and output assets must be different."
      : !amount || amount <= 0
        ? "Enter an amount greater than zero."
        : null;

  const fetchQuote = useCallback(async () => {
    if (validationError) {
      setError(validationError);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setQuote(null);

    try {
      const qs = new URLSearchParams({
        sendAsset,
        destAsset,
        amount: String(amount),
        mode,
        slippageBps: String(slippageBps),
        network: network ?? "testnet",
      });
      const res = await fetch(`/api/swap-quote?${qs}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? res.statusText);
      }
      const data: SwapQuoteResult = await res.json();
      setQuote(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [sendAsset, destAsset, amount, mode, slippageBps, network, validationError]);

  const slippagePct = slippageBps / 100;
  const priceImpact = quote?.priceImpactPct ?? null;
  const highImpact = priceImpact !== null && priceImpact > 2;
  const noLiquidity = error?.toLowerCase().includes("no liquidity") ||
    error?.toLowerCase().includes("path") ||
    error?.toLowerCase().includes("too few");

  return (
    <div className="space-y-2 rounded-xl border border-border bg-off p-3">
      {/* Validation banner */}
      {validationError && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* No-liquidity warning */}
      {noLiquidity && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>No liquidity path found. Try a smaller amount or adjust slippage.</span>
        </div>
      )}

      {/* Preview button */}
      <button
        id="swap-preview-quote-btn"
        onClick={fetchQuote}
        disabled={loading || !!validationError}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        {loading ? "Fetching quote…" : "Preview Quote"}
      </button>

      {/* Generic error */}
      {error && !noLiquidity && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}

      {/* Quote result */}
      {quote && !loading && (
        <div className="space-y-1.5 pt-1">
          {/* Estimated receive */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">Est. receive</span>
            <span className="text-[12px] font-semibold text-ink">
              {quote.expectedReceive} {destAsset}
            </span>
          </div>

          {/* Minimum received */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">Min received ({slippagePct}% slip)</span>
            <span className="text-[12px] text-ink">
              {quote.sendAmountMin} {mode === "exact-in" ? destAsset : sendAsset}
            </span>
          </div>

          {/* Route */}
          {quote.route && (
            <div className="flex items-start justify-between gap-1">
              <span className="text-[11px] text-muted shrink-0">Route</span>
              <span className="text-right text-[11px] text-ink break-all">{quote.route}</span>
            </div>
          )}

          {/* Estimated network fee */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">Est. network fee</span>
            <span className="text-[12px] text-ink">~0.00001 XLM</span>
          </div>

          {/* Price impact */}
          {priceImpact !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <TrendingDown size={11} />
                Price impact
              </span>
              <span
                className={`text-[12px] font-semibold ${
                  highImpact ? "text-red-600" : "text-green-600"
                }`}
              >
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          )}

          {/* High impact warning */}
          {highImpact && (
            <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>High price impact ({priceImpact?.toFixed(2)}%). Consider splitting the trade.</span>
            </div>
          )}

          {/* Success badge */}
          {!highImpact && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-600">
              <CheckCircle2 size={12} />
              <span>Liquidity path available</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

