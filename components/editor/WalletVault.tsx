"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Lock, Plus, Trash2, X } from "lucide-react";
import { useVaultStore } from "@/lib/vault/store";
import { createEphemeralWallet } from "@/lib/api";
import { Backdrop } from "./Backdrop";

export function WalletVault({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vault = useVaultStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      vault.load();
      setPassword("");
      setConfirm("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function createVault() {
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setError(null);
    await vault.createVault(password);
  }

  async function unlock() {
    setError(null);
    const ok = await vault.unlock(password);
    if (!ok) setError("Wrong password.");
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const w = await createEphemeralWallet();
      await vault.addWallet({
        publicKey: w.publicKey,
        secret: w.secret,
        network: w.network,
        label: `Wallet ${vault.wallets.length + 1}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create wallet.");
    } finally {
      setBusy(false);
    }
  }

  function copy(pk: string) {
    navigator.clipboard.writeText(pk);
    setCopied(pk);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
            <KeyRound size={18} className="text-accent" /> Wallet Vault
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {/* CREATE */}
        {!vault.initialized && (
          <>
            <p className="mb-4 text-[13px] text-muted">
              Create a password to encrypt your wallets. Secrets are AES-256-GCM encrypted in your
              browser (localStorage) and never sent to any server. If you forget this password, the
              wallets can&apos;t be recovered.
            </p>
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <button onClick={createVault} className="btn-dark mt-4 w-full">
              Create vault
            </button>
          </>
        )}

        {/* UNLOCK */}
        {vault.initialized && !vault.unlocked && (
          <>
            <p className="mb-4 text-[13px] text-muted">Enter your password to unlock the vault.</p>
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              onEnter={unlock}
            />
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <button onClick={unlock} className="btn-dark mt-4 w-full">
              Unlock
            </button>
          </>
        )}

        {/* UNLOCKED */}
        {vault.unlocked && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] text-muted">
                {vault.wallets.length} wallet{vault.wallets.length === 1 ? "" : "s"} · testnet
              </p>
              <button
                onClick={() => vault.lock()}
                className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
              >
                <Lock size={13} /> Lock
              </button>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {vault.wallets.map((w) => (
                <div
                  key={w.publicKey}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{w.label}</div>
                    <div className="truncate font-mono text-[11px] text-muted">{w.publicKey}</div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <button onClick={() => copy(w.publicKey)} className="rounded-md p-1.5 text-muted hover:bg-off hover:text-ink" title="Copy public key">
                      {copied === w.publicKey ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button onClick={() => vault.removeWallet(w.publicKey)} className="rounded-md p-1.5 text-muted hover:bg-off hover:text-ink" title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {vault.wallets.length === 0 && (
                <p className="rounded-lg border border-dashed border-border bg-off px-3 py-6 text-center text-[13px] text-muted">
                  No wallets yet. Generate one below to reuse it across workflows.
                </p>
              )}
            </div>

            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <button onClick={generate} disabled={busy} className="btn-dark mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {busy ? "Creating & funding…" : "Generate & fund testnet wallet"}
            </button>
          </>
        )}
      </div>
    </Backdrop>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  onEnter,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  return (
    <div className="mt-3">
      <label className="mb-1 block text-[13px] font-medium text-ink">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="w-full rounded-lg border border-border px-3 py-2 text-[14px] outline-none focus:border-accent focus:ring-4 focus:ring-accent-light"
      />
    </div>
  );
}
