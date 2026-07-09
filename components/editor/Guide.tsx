"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

const STORAGE_KEY = "soroban-studio-guide-done";

type AdvanceOn = "node-added" | "edge-added";

interface Step {
  /** CSS selector for the element to spotlight. Omit for a centered card. */
  selector?: string;
  title: string;
  body: string;
  /** Auto-advance when the user performs this action. */
  advanceOn?: AdvanceOn;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Soroban Studio 👋",
    body: "Let's build a real Stellar workflow in 6 quick steps. You can skip anytime and reopen this from the ? button.",
  },
  {
    selector: '[data-guide="palette"]',
    title: "1 · Add blocks",
    body: "These are Stellar-native building blocks. Click one (or drag it onto the canvas) to add it. Try starting with a Trigger, then Create Wallet.",
    advanceOn: "node-added",
  },
  {
    selector: '[data-guide="inspector"]',
    title: "2 · Configure it",
    body: "Select a block to edit its fields here. Fields marked * are required. Amounts, destinations, and assets (XLM / USDC) are set in this panel.",
  },
  {
    selector: '[data-guide="canvas"]',
    title: "3 · Connect the flow",
    body: "Hover a block to reveal its dots, then drag from the bottom dot of one block to the top dot of the next to wire them in order.",
    advanceOn: "edge-added",
  },
  {
    selector: '[data-guide="ai"]',
    title: "4 · Or let AI build it",
    body: "Prefer plain English? Describe your app (e.g. “create a wallet and send 10 XLM”) and the AI Builder assembles the whole workflow.",
  },
  {
    selector: '[data-guide="run"]',
    title: "5 · Run for real",
    body: "Run executes your workflow on real Stellar testnet (via the backend) and streams live logs — funded wallets, real transactions, explorer links.",
  },
  {
    selector: '[data-guide="export"]',
    title: "6 · Export your code",
    body: "Export production-ready JavaScript (@stellar/stellar-sdk) and a Soroban Rust skeleton, or the raw workflow JSON. Your workflow, your code.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Guide({ hidden = false }: { hidden?: boolean }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const nodesLen = useEditorStore((s) => s.nodes.length);
  const edgesLen = useEditorStore((s) => s.edges.length);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // Open automatically on first visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      setActive(true);
      setIndex(0);
    }
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= STEPS.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Auto-advance on the relevant user action.
  useEffect(() => {
    if (active && step?.advanceOn === "node-added" && nodesLen > 0) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesLen]);
  useEffect(() => {
    if (active && step?.advanceOn === "edge-added" && edgesLen > 0) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgesLen]);

  // Track the spotlight target position.
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      if (!step?.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    const id = window.setInterval(measure, 400); // catch layout shifts
    return () => {
      window.removeEventListener("resize", measure);
      window.clearInterval(id);
    };
  }, [active, index, step?.selector]);

  const restart = () => {
    setIndex(0);
    setActive(true);
  };

  return (
    <>
      {/* Persistent help button — hidden while the AI drawer covers this corner. */}
      {!hidden && (
        <button
          onClick={restart}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-ink shadow-md transition-colors hover:bg-off"
          title="Show the guide"
        >
          <HelpCircle size={15} className="text-accent" /> Guide
        </button>
      )}

      {active && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          {/* Spotlight: a dim overlay with a hole punched over the target. */}
          {rect ? (
            <div
              className="pointer-events-none absolute rounded-xl transition-all duration-300"
              style={{
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                boxShadow: "0 0 0 9999px rgba(17,17,16,0.55)",
                outline: "2px solid var(--accent)",
                outlineOffset: 2,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-ink/55" />
          )}

          <GuideCard
            rect={rect}
            step={step}
            index={index}
            total={STEPS.length}
            isLast={isLast}
            onNext={next}
            onBack={back}
            onSkip={finish}
          />
        </div>
      )}
    </>
  );
}

function GuideCard({
  rect,
  step,
  index,
  total,
  isLast,
  onNext,
  onBack,
  onSkip,
}: {
  rect: Rect | null;
  step: Step;
  index: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  // Position the card near the target, clamped to the viewport.
  const CARD_W = 320;
  let style: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  if (rect && typeof window !== "undefined") {
    const below = rect.top + rect.height + 16;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const top = spaceBelow > 220 ? below : Math.max(16, rect.top - 220);
    let left = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - CARD_W - 16));
    style = { top, left, width: CARD_W };
  } else {
    style = { ...style, width: CARD_W };
  }

  return (
    <div
      className="pointer-events-auto absolute rounded-2xl border border-border bg-white p-5 shadow-2xl"
      style={style}
    >
      <button
        onClick={onSkip}
        className="absolute right-3 top-3 text-muted hover:text-ink"
        aria-label="Skip guide"
      >
        <X size={16} />
      </button>
      <div className="mb-1 font-mono text-[11px] text-muted">
        Step {index + 1} of {total}
      </div>
      <h3 className="font-serif text-lg text-ink">{step.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{step.body}</p>

      {step.advanceOn && (
        <p className="mt-2 text-[12px] font-medium text-accent">
          ↳ Do it on the canvas and I&apos;ll advance automatically.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button onClick={onSkip} className="text-[12px] text-muted hover:text-ink">
          Skip tour
        </button>
        <div className="flex gap-2">
          {index > 0 && (
            <button onClick={onBack} className="btn-ghost">
              Back
            </button>
          )}
          <button onClick={onNext} className="btn-dark">
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
