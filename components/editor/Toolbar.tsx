"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, Download, KeyRound, Play, Sparkles, Trash } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

export function Toolbar({
  onRun,
  onExport,
  onAI,
  onVault,
  onSchedule,
  running,
}: {
  onRun: () => void;
  onExport: () => void;
  onAI: () => void;
  onVault: () => void;
  onSchedule: () => void;
  running: boolean;
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
        <button
          data-guide="schedule"
          onClick={onSchedule}
          disabled={nodes.length === 0}
          className="btn-ghost flex items-center gap-1.5 disabled:opacity-40"
        >
          <CalendarClock size={14} /> Schedule
        </button>
        <button data-guide="ai" onClick={onAI} className="btn-ghost flex items-center gap-1.5">
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
