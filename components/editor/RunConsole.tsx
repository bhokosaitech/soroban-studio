"use client";

import { Terminal, X } from "lucide-react";
import type { RunLog } from "@/lib/soroban/sandbox";

const LEVEL_COLOR: Record<RunLog["level"], string> = {
  info: "#9b9a95",
  success: "#22c55e",
  error: "#f87171",
  network: "#60a5fa",
  warn: "#fbbf24",
};

export function RunConsole({
  logs,
  running,
  onClose,
}: {
  logs: RunLog[];
  running: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex h-48 flex-col border-t border-border bg-[#1a1a19]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 text-[12px] font-medium text-white/80">
          <Terminal size={14} />
          Sandbox console
          {running && <span className="text-[11px] text-white/40">running…</span>}
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-2 font-mono text-[12px] leading-relaxed">
        {logs.length === 0 && (
          <div className="text-white/30">No output yet — press Run to simulate the workflow.</div>
        )}
        {logs.map((log, i) => (
          <div key={i} style={{ color: LEVEL_COLOR[log.level] }}>
            <span className="text-white/25">{new Date(log.at).toLocaleTimeString()} </span>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
