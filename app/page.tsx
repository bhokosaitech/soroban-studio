"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Clock,
  FileCode2,
  LineChart,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { WaitlistModal } from "@/components/site/WaitlistModal";

export default function LandingPage() {
  const [waitlist, setWaitlist] = useState(false);

  // Scroll-reveal for `.reveal` sections.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {/* NAV */}
      <nav className="fixed inset-x-0 top-2.5 z-50 mx-auto flex h-14 max-w-3xl items-center justify-between rounded-[10px] border border-border bg-white/90 px-4 backdrop-blur-md">
        <Logo />
        <ul className="flex items-center gap-7">
          <li className="hidden sm:block">
            <a href="#features" className="text-[14px] text-muted transition-colors hover:text-ink">
              Features
            </a>
          </li>
          <li className="hidden sm:block">
            <a href="#how" className="text-[14px] text-muted transition-colors hover:text-ink">
              How it works
            </a>
          </li>
          <li>
            <Link href="/editor" className="text-[14px] font-medium text-ink transition-colors hover:text-accent">
              Open Studio
            </Link>
          </li>
        </ul>
      </nav>

      {/* HERO */}
      <section className="hero mx-auto max-w-3xl px-6 pt-40 pb-12 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-off px-3 py-1.5 text-[13px] text-muted">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Built for Stellar &amp; Soroban
        </div>
        <h1 className="font-serif text-[clamp(2.5rem,6vw,4rem)] leading-[1.05] tracking-tight text-ink">
          Build Stellar apps
          <br />
          <em>without writing</em> the hard parts
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[17px] text-muted">
          Drag-and-drop visual workflows for wallets, payments, asset transfers, and smart
          contract calls — then generate production-ready code instantly.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/editor" className="btn-primary flex items-center gap-2">
            Launch the editor <ArrowRight size={16} />
          </Link>
          <button onClick={() => setWaitlist(true)} className="btn-outline px-5 py-[11px] text-[15px]">
            Join waitlist
          </button>
        </div>
      </section>

      {/* CANVAS PREVIEW */}
      <section className="reveal mx-auto max-w-4xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-1.5 border-b border-border bg-off px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="grid grid-cols-[130px_1fr]">
            <div className="border-r border-border bg-off p-3">
              <div className="mb-2 text-[10px] font-medium uppercase text-muted">Blocks</div>
              {[
                ["Wallet", "#1a6cf2"],
                ["Payment", "#16a34a"],
                ["Asset", "#d97706"],
                ["Contract", "#7c3aed"],
                ["Automation", "#db2777"],
              ].map(([label, color]) => (
                <div
                  key={label}
                  className="mb-1.5 flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-[12px] text-ink"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
            <div className="bg-[radial-gradient(circle,#e6e4dc_1px,transparent_1px)] [background-size:16px_16px] p-2">
              <HeroDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-[12px] font-medium uppercase tracking-wide text-accent">Features</div>
        <h2 className="reveal mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] tracking-tight text-ink">
          Everything you need to build on Stellar
        </h2>
        <div className="reveal mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-off text-ink">
                <f.icon size={20} strokeWidth={1.6} />
              </div>
              <h3 className="text-[15px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[14px] text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-5xl px-6 py-20">
        <div className="border-t border-border pt-20">
          <div className="text-[12px] font-medium uppercase tracking-wide text-accent">
            How it works
          </div>
          <h2 className="reveal mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] tracking-tight text-ink">
            From idea to deployed app in minutes
          </h2>
          <div className="reveal mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <div className="mb-4 flex items-center gap-2 font-mono text-[12px] text-muted">
                  0{i + 1}
                  <span className="h-px flex-1 bg-border" />
                </div>
                <h3 className="text-[15px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[14px] text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="border-t border-border pt-20">
          <div className="text-[12px] font-medium uppercase tracking-wide text-accent">
            Who it&apos;s for
          </div>
          <h2 className="reveal mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] tracking-tight text-ink">
            Built for builders at every level
          </h2>
          <div className="reveal mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w) => (
              <div key={w.title} className="rounded-xl bg-off p-5">
                <h4 className="text-[14px] font-semibold text-ink">{w.title}</h4>
                <p className="mt-1 text-[13px] text-muted">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h2 className="font-serif text-[clamp(2rem,5vw,3rem)] tracking-tight text-ink">
          Start building visually
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[17px] text-muted">
          Open the editor and assemble your first Stellar workflow — no setup required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/editor" className="btn-primary flex items-center gap-2">
            Open the editor <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-8">
        <p className="font-mono text-[13px] text-muted">© 2026 Soroban Studio</p>
        <div className="flex gap-6 text-[13px] text-muted">
          <Link href="/editor" className="hover:text-ink">
            Editor
          </Link>
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
        </div>
      </footer>

      <WaitlistModal open={waitlist} onClose={() => setWaitlist(false)} />
    </div>
  );
}

const FEATURES = [
  { icon: Blocks, title: "Visual block editor", body: "Drag and drop reusable blocks for wallets, payments, asset transfers, and contract calls." },
  { icon: Sparkles, title: "AI-assisted generation", body: "Describe your app in plain English and get a complete visual workflow generated instantly." },
  { icon: LineChart, title: "Sandbox environment", body: "Test workflows against Stellar testnet before deploying. Catch issues before they cost real XLM." },
  { icon: FileCode2, title: "Code export", body: "Export clean, production-ready JavaScript and Soroban Rust that you own and deploy anywhere." },
  { icon: Puzzle, title: "Smart contract blocks", body: "Invoke and deploy Soroban contracts through visual wrappers — no Rust required to get started." },
  { icon: Clock, title: "Ship in hours", body: "Go from concept to a working Stellar demo in a single sitting — perfect for hackathons." },
];

const STEPS = [
  { title: "Describe or drag", body: "Type a prompt like “create a payment flow with wallet connection” or drag blocks onto the canvas." },
  { title: "Connect your blocks", body: "Wire up triggers, conditions, actions, and outputs with the visual connector system." },
  { title: "Test in sandbox", body: "Run your workflow against testnet with live event logs and transaction previews." },
  { title: "Export & ship", body: "Download production-ready code or deploy directly. Your workflow, your code." },
];

const WHO = [
  { title: "Developers", body: "Skip boilerplate. Prototype Stellar apps 10× faster and export clean code to build on." },
  { title: "Students", body: "Learn blockchain concepts visually before diving into Rust or the Soroban SDK." },
  { title: "Entrepreneurs", body: "Validate payment and fintech ideas on Stellar without hiring a blockchain engineer first." },
  { title: "Hackathon teams", body: "Ship a working Stellar demo in hours, not days. More building, less debugging SDKs." },
];

/** The static hero workflow illustration. */
function HeroDiagram() {
  return (
    <svg viewBox="0 0 560 320" className="w-full" fontFamily="var(--font-sans)">
      <line x1="150" y1="80" x2="220" y2="80" stroke="#d0cec7" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="340" y1="80" x2="400" y2="80" stroke="#d0cec7" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="280" y1="104" x2="280" y2="180" stroke="#d0cec7" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="280" y1="228" x2="280" y2="270" stroke="#d0cec7" strokeWidth="1.5" strokeDasharray="4 3" />

      <rect x="30" y="56" width="120" height="48" rx="8" fill="#111110" />
      <text x="90" y="76" textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Trigger</text>
      <text x="90" y="92" textAnchor="middle" fill="#888" fontSize="10">User initiates</text>

      <rect x="220" y="56" width="120" height="48" rx="8" fill="white" stroke="#e4e2db" />
      <circle cx="244" cy="80" r="7" fill="#eef3fe" />
      <circle cx="244" cy="80" r="3" fill="#1a6cf2" className="pulse" />
      <text x="292" y="76" textAnchor="middle" fill="#111110" fontSize="11" fontWeight="500">Connect Wallet</text>
      <text x="292" y="92" textAnchor="middle" fill="#888" fontSize="10">Freighter</text>

      <rect x="400" y="56" width="120" height="48" rx="8" fill="white" stroke="#e4e2db" />
      <text x="460" y="76" textAnchor="middle" fill="#111110" fontSize="11" fontWeight="500">Check Balance</text>
      <text x="460" y="92" textAnchor="middle" fill="#888" fontSize="10">Horizon API</text>

      <rect x="220" y="180" width="120" height="48" rx="8" fill="#f0fdf4" stroke="#bbf7d0" />
      <text x="280" y="200" textAnchor="middle" fill="#16a34a" fontSize="11" fontWeight="500">Send Payment</text>
      <text x="280" y="216" textAnchor="middle" fill="#4ade80" fontSize="10">XLM / USDC</text>

      <rect x="220" y="270" width="120" height="40" rx="8" fill="white" stroke="#e4e2db" />
      <text x="280" y="294" textAnchor="middle" fill="#111110" fontSize="11" fontWeight="500">On Success ✓</text>
    </svg>
  );
}
