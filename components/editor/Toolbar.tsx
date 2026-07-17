"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, Check, CloudOff, Download, Globe, KeyRound, Loader2, Play, Sparkles, Trash, Upload } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import type { SaveStatus } from "./useAutoSave";

export function Toolbar({
  onRun,
  onExport,
  onImport,
  onAI,
  onVault,
  onSchedule,
  onShare,
  running,
  aiOpen,
  saveStatus,
}: {
  onRun: () => void;
  onExport: () => void;
  onImport: () => void;
  onAI: () => void;
  onVault: () => void;
  onSchedule: () => void;
  onShare: () => void;
  running: boolean;
  aiOpen: boolean;
  saveStatus: SaveStatus;
}) {
  const { meta, setMeta, clear, nodes } = useEditorStore();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <span className="text-border">/</span>
        <input
          value={meta.name}
          onChange={(e) => setMeta({ name: e.target.value })}
          className="rounded-md px-1.5 py-1 text-[14px] font-medium text-ink outline-none hover:bg-off focus:bg-off"
        />
        <span
          className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted"
        >
          {meta.network}
        </span>
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={clear}
          disabled={nodes.length === 0}
          className="btn-ghost flex items-center gap-1.5 disabled:opacity-40"
          title="Clear canvas"
        >
          <Trash size={14} /> Clear
        </button>
        <button data-guide="vault" onClick={onVault} className="btn-ghost flex items-center gap-1.5">
          <KeyRound size={14} /> Wallets
        </button>
        <button onClick={onImport} className="btn-ghost flex items-center gap-1.5" title="Import workflow JSON">
          <Upload size={14} /> Import
        </button>
        <button
          data-guide="schedule"
          onClick={onSchedule}
          disabled={nodes.length === 0}
          className="btn-ghost flex items-center gap-1.5 disabled:opacity-40"
        >
          <CalendarClock size={14} /> Schedule
        </button>
        <button
          data-guide="share"
          onClick={onShare}
          disabled={nodes.length === 0}
          className="btn-ghost flex items-center gap-1.5 disabled:opacity-40"
        >
          <Globe size={14} /> Share
        </button>
        <button
          data-guide="ai"
          onClick={onAI}
          aria-pressed={aiOpen}
          className={`btn-ghost flex items-center gap-1.5 ${aiOpen ? "bg-accent-light text-accent" : ""}`}
        >
          <Sparkles size={14} className="text-accent" /> AI Builder
        </button>
        <button
          data-guide="run"
          onClick={onRun}
          disabled={running || nodes.length === 0}
          className="btn-outline flex items-center gap-1.5 disabled:opacity-40"
        >
          <Play size={14} /> {running ? "Running…" : "Run"}
        </button>
        <button
          data-guide="export"
          onClick={onExport}
          disabled={nodes.length === 0}
          className="btn-dark flex items-center gap-1.5 disabled:opacity-40"
        >
          <Download size={14} /> Export
        </button>
      </div>
    </header>
  );
}

/** Small ambient indicator reflecting the debounced auto-save state. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map = {
    saving: { icon: <Loader2 size={12} className="animate-spin" />, text: "Saving…", cls: "text-muted" },
    saved: { icon: <Check size={12} />, text: "Saved", cls: "text-muted" },
    error: { icon: <CloudOff size={12} />, text: "Save failed", cls: "text-red-600" },
  } as const;
  const s = map[status];
  return (
    <span className={`flex items-center gap-1 text-[11px] ${s.cls}`} title="Auto-save">
      {s.icon} {s.text}
    </span>
  );
}
