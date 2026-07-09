"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Trash2, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { validateWorkflow } from "@/lib/workflow";
import {
  cancelScheduleReq,
  isBackendUnavailable,
  listSchedules,
  scheduleWorkflow,
  type Schedule,
} from "@/lib/api";
import { Backdrop } from "./Backdrop";

export function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toWorkflow = useEditorStore((s) => s.toWorkflow);
  const [when, setWhen] = useState("");
  const [minWhen, setMinWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [mode, setMode] = useState<string>("");

  useEffect(() => {
    if (open) {
      setError(null);
      setOk(null);
      setMinWhen(nowLocalInput());
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function refresh() {
    try {
      const { schedules, mode } = await listSchedules();
      setSchedules(schedules);
      setMode(mode);
    } catch {
      /* backend down — leave empty */
    }
  }

  if (!open) return null;

  async function submit() {
    setError(null);
    setOk(null);
    if (!when) return setError("Pick a date and time.");
    const runAt = new Date(when);
    if (Number.isNaN(runAt.getTime()) || runAt.getTime() < Date.now()) {
      return setError("Choose a time in the future.");
    }
    const wf = toWorkflow();
    const problems = validateWorkflow(wf);
    if (problems.length) return setError(problems[0]);

    try {
      const res = await scheduleWorkflow(wf, runAt.toISOString());
      setOk(`Scheduled for ${runAt.toLocaleString()} (${res.mode} mode).`);
      setWhen("");
      refresh();
    } catch (e) {
      if (isBackendUnavailable(e)) setError("Backend not reachable — start it in /server.");
      else setError(e instanceof Error ? e.message : "Could not schedule.");
    }
  }

  async function cancel(id: string) {
    await cancelScheduleReq(id);
    refresh();
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
            <CalendarClock size={18} className="text-accent" /> Schedule workflow
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[13px] text-muted">
          Pick a date and time to run this workflow automatically on testnet.
          {mode && (
            <>
              {" "}
              Engine: <span className="font-medium text-ink">{mode === "redis" ? "Redis (BullMQ)" : "DB poller"}</span>.
            </>
          )}
        </p>

        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={when}
            min={minWhen}
            onChange={(e) => setWhen(e.target.value)}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-[14px] outline-none focus:border-accent focus:ring-4 focus:ring-accent-light"
          />
          <button onClick={submit} className="btn-dark">
            Schedule
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
        {ok && <p className="mt-2 text-[12px] text-green-600">{ok}</p>}

        {schedules.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Upcoming
            </h3>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{s.name}</div>
                    <div className="text-[11px] text-muted">
                      {new Date(s.runAt).toLocaleString()} · <StatusBadge status={s.status} />
                    </div>
                  </div>
                  {s.status === "scheduled" && (
                    <button onClick={() => cancel(s.id)} className="rounded-md p-1.5 text-muted hover:bg-off hover:text-ink" title="Cancel">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "done" ? "text-green-600" : status === "failed" ? "text-red-600" : status === "canceled" ? "text-muted" : "text-accent";
  return <span className={color}>{status}</span>;
}

/** Current local time formatted for a `datetime-local` input (YYYY-MM-DDTHH:mm). */
function nowLocalInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
