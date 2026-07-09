"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import type { Workflow } from "@/lib/workflow";

const EXAMPLES = [
  "Create a wallet, fund it on testnet, then send 10 XLM to a destination",
  "Wait for a USDC payment, verify it, then trigger a webhook to my server",
  "Generate an invoice for 50 USDC and notify me when it's paid",
];

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

let msgSeq = 1;

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed the composer from a prompt passed in (e.g. the landing-page hero input).
  useEffect(() => {
    if (open && initialPrompt) setPrompt(initialPrompt);
  }, [open, initialPrompt]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (!open) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setPrompt("");
    setMessages((m) => [...m, { id: msgSeq++, role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = (await res.json()) as { workflow?: Workflow; source?: string; error?: string };
      if (!res.ok || !data.workflow) throw new Error(data.error ?? "Generation failed.");
      loadWorkflow(data.workflow);
      const count = data.workflow.nodes.length;
      const via = data.source ? ` (via ${data.source})` : "";
      setMessages((m) => [
        ...m,
        {
          id: msgSeq++,
          role: "assistant",
          content: `Done — I placed ${count} block${count === 1 ? "" : "s"} on your canvas${via}. Tell me what to change and I'll rebuild it.`,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: msgSeq++,
          role: "assistant",
          content: e instanceof Error ? e.message : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(prompt);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/40 backdrop-blur-sm backdrop-fade"
      onClick={onClose}
    >
      <aside
        data-guide="ai-panel"
        onClick={(e) => e.stopPropagation()}
        className="drawer-in flex h-full w-96 max-w-[90vw] shrink-0 flex-col border-l border-border bg-white shadow-xl"
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Sparkles size={16} className="text-accent" /> AI Builder
        </h2>
        <button onClick={onClose} className="text-muted transition-colors hover:text-ink" title="Close">
          <X size={16} />
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !loading ? (
          <div className="mt-2">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent-light">
              <Sparkles size={16} className="text-accent" />
            </div>
            <p className="text-[14px] font-medium text-ink">Describe your app</p>
            <p className="mt-1 text-[13px] leading-snug text-muted">
              Tell me what you want to build in plain English and I&apos;ll assemble the workflow on
              the canvas.
            </p>
            <div className="mt-4 space-y-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => void send(ex)}
                  className="block w-full rounded-lg border border-border px-3 py-2 text-left text-[12px] leading-snug text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)
        )}
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <span className="flex gap-1">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </span>
            Assembling workflow…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-off px-2.5 py-2 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-light">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message AI Builder…"
            className="max-h-32 flex-1 resize-none bg-transparent py-1 text-[13px] text-ink outline-none placeholder:text-muted"
          />
          <button
            onClick={() => void send(prompt)}
            disabled={loading || !prompt.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white transition-opacity disabled:opacity-30"
            title="Send"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-muted">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </aside>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-[13px] leading-snug text-white">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light">
        <Sparkles size={12} className="text-accent" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-off px-3 py-2 text-[13px] leading-snug text-ink">
        {content}
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
      style={{ animationDelay: delay }}
    />
  );
}
