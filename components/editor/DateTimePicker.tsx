"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Self-contained date + time picker (no dependency). Value is a local
 * `YYYY-MM-DDTHH:mm` string — the same shape the native datetime-local input
 * produced — so callers need no other changes. Past days are non-selectable,
 * and on the current day past times are disabled.
 */
export function DateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const parsed = parseLocal(value);

  // The month currently shown in the grid (defaults to the selected/current month).
  const [view, setView] = useState(() => {
    const base = parsed ?? now;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const selected = parsed;
  const todayStart = startOfDay(now);

  const grid = useMemo(() => buildMonth(view.year, view.month), [view]);
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Time parts derived from the selection (default to the next round hour).
  const hour24 = selected?.getHours() ?? now.getHours();
  const minute = selected?.getMinutes() ?? 0;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;

  function commit(next: Date) {
    onChange(formatLocal(next));
  }

  function pickDay(day: Date) {
    // Preserve the chosen time (or default to the next hour if nothing set yet).
    const base = selected ?? roundUpHour(now);
    const next = new Date(day);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    // If picking today with a now-past time, bump to the next valid slot.
    if (isSameDay(next, now) && next.getTime() < now.getTime()) {
      const bumped = roundUpHour(now);
      next.setHours(bumped.getHours(), bumped.getMinutes(), 0, 0);
    }
    commit(next);
  }

  function setTime(h24: number, m: number) {
    const base = selected ?? todayStart;
    const next = new Date(base);
    next.setHours(h24, m, 0, 0);
    commit(next);
  }

  const canPrevMonth =
    view.year > todayStart.getFullYear() ||
    (view.year === todayStart.getFullYear() && view.month > todayStart.getMonth());

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      {/* Month header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrevMonth}
          onClick={() => setView(shiftMonth(view, -1))}
          className="rounded-md p-1 text-muted transition-colors hover:bg-off hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold text-ink">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setView(shiftMonth(view, 1))}
          className="rounded-md p-1 text-muted transition-colors hover:bg-off hover:text-ink"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {d}
          </div>
        ))}
        {grid.map((day, i) => {
          if (!day) return <div key={`b${i}`} />;
          const past = startOfDay(day).getTime() < todayStart.getTime();
          const isSelected = selected && isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={past}
              onClick={() => pickDay(day)}
              className={`aspect-square rounded-lg text-[12px] transition-colors ${
                isSelected
                  ? "bg-ink font-semibold text-white"
                  : past
                    ? "cursor-not-allowed text-muted/40"
                    : "text-ink hover:bg-accent-light hover:text-accent"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time row */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <span className="text-[12px] font-medium text-ink">Time</span>
        <div className="ml-auto flex items-center gap-1.5">
          <select
            value={hour12}
            onChange={(e) => setTime(to24(Number(e.target.value), ampm), minute)}
            className="picker-select"
            aria-label="Hour"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="text-muted">:</span>
          <select
            value={minute}
            onChange={(e) => setTime(hour24, Number(e.target.value))}
            className="picker-select"
            aria-label="Minute"
          >
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <select
            value={ampm}
            onChange={(e) => setTime(to24(hour12, e.target.value as "AM" | "PM"), minute)}
            className="picker-select"
            aria-label="AM or PM"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      <style jsx>{`
        .picker-select {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 13px;
          background: var(--white);
          color: var(--ink);
          outline: none;
        }
        .picker-select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-light);
        }
      `}</style>
    </div>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Days of a month laid into a 7-wide grid, padded with nulls for alignment. */
function buildMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(v: { year: number; month: number }, delta: number) {
  const d = new Date(v.year, v.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function roundUpHour(d: Date): Date {
  const c = new Date(d);
  c.setHours(c.getHours() + 1, 0, 0, 0);
  return c;
}

function to24(hour12: number, ampm: "AM" | "PM"): number {
  const h = hour12 % 12;
  return ampm === "PM" ? h + 12 : h;
}

/** Parse a local `YYYY-MM-DDTHH:mm` string; null if empty/invalid. */
function parseLocal(v: string): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a Date as a local `YYYY-MM-DDTHH:mm` string. */
function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
