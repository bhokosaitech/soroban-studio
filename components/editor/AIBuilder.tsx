"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import type { Workflow } from "@/lib/workflow";

const EXAMPLES = [
  "Create a wallet, fund it on testnet, then send 10 XLM to a destination",
  "Wait for a USDC payment, verify it, then trigger a webhook to my server",
  "Generate an invoice for 50 USDC and notify me when it's paid",
];

export function AIBuilder({
  open,
  onClose,
  initialPrompt,
}: {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
}) {
  const loadWorkflow = useEditorStore((s) => s.loadWorkflow);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // Seed from a prompt passed in (e.g. the landing-page hero input).
  useEffect(() => {
    if (open && initialPrompt) setPrompt(initialPrompt);
  }, [open, initialPrompt]);

  if (!open) return null;

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as { workflow?: Workflow; source?: string; error?: string };
      if (!res.ok || !data.workflow) throw new Error(data.error ?? "Generation failed.");
      loadWorkflow(data.workflow);
      setSource(data.source ?? null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
            <Sparkles size={18} className="text-accent" /> AI Builder
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[13px] text-muted">
          Describe your app in plain English — we&apos;ll assemble the workflow.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. Create a wallet and send a shielded payment when an invoice is paid…"
          className="w-full resize-none rounded-lg border border-border p-3 text-[14px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-light"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {ex.slice(0, 42)}…
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
        {source && <p className="mt-3 text-[12px] text-muted">Generated via {source}.</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={generate} disabled={loading || !prompt.trim()} className="btn-dark">
            {loading ? "Generating…" : "Generate workflow"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

export function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {children}
    </div>
  );
}
