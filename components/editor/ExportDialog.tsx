"use client";

import { useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { generateJavaScript } from "@/lib/codegen/javascript";
import { generateRust } from "@/lib/codegen/rust";
import { extractNodeSecrets } from "@/lib/workflow";
import { Backdrop } from "./AIBuilder";

type Tab = "javascript" | "rust" | "json";

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toWorkflow = useEditorStore((s) => s.toWorkflow);
  const [tab, setTab] = useState<Tab>("javascript");
  const [copied, setCopied] = useState(false);

  const outputs = useMemo(() => {
    if (!open) return { javascript: "", rust: "", json: "" };
    // Never export raw private keys entered on Connect Wallet blocks.
    const { workflow: wf } = extractNodeSecrets(toWorkflow());
    return {
      javascript: generateJavaScript(wf),
      rust: generateRust(wf),
      json: JSON.stringify(wf, null, 2),
    };
  }, [open, toWorkflow]);

  if (!open) return null;

  const code = outputs[tab];
  const tabs: { id: Tab; label: string }[] = [
    { id: "javascript", label: "JavaScript" },
    { id: "rust", label: "Rust (Soroban)" },
    { id: "json", label: "Workflow JSON" },
  ];

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  tab === t.id ? "bg-ink text-white" : "text-muted hover:bg-off"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="btn-ghost flex items-center gap-1.5">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={onClose} className="text-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto bg-[#fbfaf7] p-5 font-mono text-[12.5px] leading-relaxed text-ink">
          <code>{code}</code>
        </pre>
      </div>
    </Backdrop>
  );
}
