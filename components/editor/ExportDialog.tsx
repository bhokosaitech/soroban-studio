"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-json";
import "prismjs/themes/prism.css";
import { useEditorStore } from "@/lib/store/editor";
import { generateJavaScript } from "@/lib/codegen/javascript";
import { generateRust } from "@/lib/codegen/rust";
import { extractNodeSecrets } from "@/lib/workflow";
import { Backdrop } from "./Backdrop";

type Tab = "javascript" | "rust" | "json";

const TAB_META: Record<Tab, { lang: string; ext: string }> = {
  javascript: { lang: "javascript", ext: "js" },
  rust: { lang: "rust", ext: "rs" },
  json: { lang: "json", ext: "json" },
};

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toWorkflow = useEditorStore((s) => s.toWorkflow);
  const [tab, setTab] = useState<Tab>("javascript");
  const [copied, setCopied] = useState(false);

  const { outputs, name } = useMemo(() => {
    if (!open) return { outputs: { javascript: "", rust: "", json: "" }, name: "workflow" };
    // Never export raw private keys entered on Connect Wallet blocks.
    const { workflow: wf } = extractNodeSecrets(toWorkflow());
    return {
      outputs: {
        javascript: generateJavaScript(wf),
        rust: generateRust(wf),
        json: JSON.stringify(wf, null, 2),
      },
      name: wf.meta.name,
    };
  }, [open, toWorkflow]);

  const code = outputs[tab];

  // Prism-highlighted HTML for the active tab (input is our own generated code
  // with secrets already stripped, so the HTML is safe to inject).
  const highlighted = useMemo(
    () => Prism.highlight(code, Prism.languages[TAB_META[tab].lang], TAB_META[tab].lang),
    [code, tab]
  );

  if (!open) return null;

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

  function download() {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.${TAB_META[tab].ext}`;
    a.click();
    URL.revokeObjectURL(url);
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
            <button onClick={download} className="btn-ghost flex items-center gap-1.5">
              <Download size={14} />
              Download
            </button>
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
          <code
            className={`language-${TAB_META[tab].lang}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </Backdrop>
  );
}
