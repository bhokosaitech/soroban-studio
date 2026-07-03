"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  CalendarClock,
  Code2,
  KeyRound,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { WaitlistModal } from "@/components/site/WaitlistModal";

export default function LandingPage() {
  const router = useRouter();
  const [waitlist, setWaitlist] = useState(false);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function build() {
    const p = prompt.trim();
    router.push(`/editor${p ? `?prompt=${encodeURIComponent(p)}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-off text-ink">
      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-off/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-[14px] text-muted transition-colors hover:text-ink">
              Features
            </a>
            <a href="#how" className="text-[14px] text-muted transition-colors hover:text-ink">
              How it works
            </a>
            <button onClick={() => setWaitlist(true)} className="text-[14px] text-muted transition-colors hover:text-ink">
              Waitlist
            </button>
          </div>
          <ArrowButton href="/editor">Open Studio</ArrowButton>
        </div>
      </nav>

      <div className="relative">
        {/* Full-height vertical rails framing the content column */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex justify-center">
          <div className="h-full w-full max-w-6xl border-x border-border" />
        </div>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-36 pb-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Visual builder for Stellar &amp; Soroban
          </div>
          <h1 className="font-serif text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.02em]">
            Build Stellar apps.
            <br />
            Visually.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
            Soroban Studio turns drag-and-drop workflows into real, on-chain apps — tested on
            testnet, then exported to production-ready code.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ArrowButton href="/editor" large>
              Launch the editor
            </ArrowButton>
            <button
              onClick={() => setWaitlist(true)}
              className="text-[15px] font-medium text-muted transition-colors hover:text-ink"
            >
              Join waitlist
            </button>
          </div>

          {/* Prompt bar → AI Builder */}
          <div className="mt-8 flex max-w-md items-center gap-2 rounded-xl border border-border bg-white p-1.5 shadow-sm">
            <Sparkles size={16} className="ml-2 shrink-0 text-accent" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && build()}
              placeholder="Describe an app for AI to build…"
              className="min-w-0 flex-1 bg-transparent px-1 text-[14px] text-ink placeholder:text-muted/60 focus:outline-none"
            />
            <button
              onClick={build}
              className="shrink-0 rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black"
            >
              Build
            </button>
          </div>
        </div>

        {/* Hero graphic */}
        <div className="reveal">
          <WorkflowGraphic />
        </div>
      </section>

      {/* BUILT ON — hairline grid row */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6 [&>*]:bg-white">
            {["Stellar SDK", "Soroban RPC", "Horizon", "React Flow", "DeepSeek", "Redis · BullMQ"].map((t) => (
              <div key={t} className="flex items-center justify-center px-4 py-6 text-[13px] font-medium text-muted transition-colors hover:text-ink">
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENTO FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <SectionLabel>Features</SectionLabel>
            <h2 className="reveal mt-2 max-w-lg font-serif text-[clamp(2rem,4vw,3rem)] tracking-[-0.02em]">
              A full toolkit, one canvas.
            </h2>
          </div>
        </div>

        <div className="reveal overflow-hidden rounded-3xl border border-border">
          <div className="grid auto-rows-[200px] grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-white">
            {/* A — big */}
            <BentoCell className="sm:col-span-2 sm:row-span-2" icon={Blocks} title="Visual block editor" big>
              <p className="text-[14px] leading-relaxed text-muted">
                Drag Stellar-native blocks — wallets, payments, trustlines, contract calls — onto an
                infinite canvas and wire them into a flow.
              </p>
              <div className="mt-5">
                <MiniFlow />
              </div>
            </BentoCell>

            <BentoCell className="sm:col-span-2" icon={Sparkles} title="AI Builder">
              <p className="text-[13px] leading-relaxed text-muted">
                Describe your app in plain English — DeepSeek assembles the whole workflow.
              </p>
            </BentoCell>

            <BentoCell icon={Zap} title="Real testnet runs">
              <p className="text-[13px] leading-relaxed text-muted">Live execution, streamed logs, real tx hashes.</p>
            </BentoCell>

            <BentoCell icon={Code2} title="Code export">
              <p className="text-[13px] leading-relaxed text-muted">Clean JS + Soroban Rust you own.</p>
            </BentoCell>

            <BentoCell className="sm:col-span-2" icon={KeyRound} title="Encrypted wallet vault">
              <p className="text-[13px] leading-relaxed text-muted">
                Generate and reuse wallets, encrypted in your browser with AES-256-GCM. Secrets never
                leave your device.
              </p>
            </BentoCell>

            <BentoCell className="sm:col-span-2" icon={CalendarClock} title="Scheduled runs">
              <p className="text-[13px] leading-relaxed text-muted">
                Fire a workflow at any future date with Redis-backed scheduling. Set it and forget it.
              </p>
            </BentoCell>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — hairline grid */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <SectionLabel>How it works</SectionLabel>
        <h2 className="reveal mt-2 max-w-lg font-serif text-[clamp(2rem,4vw,3rem)] tracking-[-0.02em]">
          Idea to on-chain in four steps.
        </h2>
        <div className="reveal mt-8 overflow-hidden rounded-3xl border border-border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-white">
            {STEPS.map((s, i) => (
              <div key={s.title} className="p-7">
                <div className="mb-6 font-mono text-[13px] text-muted">0{i + 1}</div>
                <h3 className="font-serif text-[20px] tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO — tinted cards */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionLabel>Who it&apos;s for</SectionLabel>
        <h2 className="reveal mt-2 max-w-lg font-serif text-[clamp(2rem,4vw,3rem)] tracking-[-0.02em]">
          Builders at every level.
        </h2>
        <div className="reveal mt-8 grid gap-5 md:grid-cols-3">
          {WHO.map((w) => (
            <div key={w.title} className="rounded-2xl border border-border p-7" style={{ background: w.bg }}>
              <h3 className="font-serif text-[22px] tracking-tight">{w.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-border bg-white px-8 py-16 text-center">
          <h2 className="font-serif text-[clamp(2.2rem,5vw,3.4rem)] tracking-[-0.02em]">
            Start building on Stellar.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[16px] text-muted">
            Open the editor and assemble your first real workflow. No setup, no signup.
          </p>
          <div className="mt-8 flex justify-center">
            <ArrowButton href="/editor" large>
              Launch the editor
            </ArrowButton>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs font-serif text-[22px] leading-tight tracking-tight text-ink">
              Build on Stellar.
              <br />
              Onchain.
            </p>
            <div className="mt-6">
              <ArrowButton href="/editor">Launch app</ArrowButton>
            </div>
          </div>
          <FooterCol title="Product" links={[["Editor", "/editor"], ["Dashboard", "/dashboard"], ["Features", "#features"]]} />
          <FooterCol title="Project" links={[["How it works", "#how"], ["Testnet", "#"], ["Open source", "#"]]} />
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-8">
          <p className="font-mono text-[12px] text-muted">
            © 2026 Soroban Studio · Stellar/Soroban testnet · not affiliated with the Stellar Development Foundation.
          </p>
        </div>
      </footer>
      </div>

      <WaitlistModal open={waitlist} onClose={() => setWaitlist(false)} />
    </div>
  );
}

/* ---------------------------------------------------------- shared pieces */
function ArrowButton({
  href,
  children,
  large,
}: {
  href: string;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2.5 rounded-full bg-ink font-medium text-white transition-colors hover:bg-black ${
        large ? "py-1.5 pl-6 pr-1.5 text-[15px]" : "py-1 pl-4 pr-1 text-[13px]"
      }`}
    >
      {children}
      <span
        className={`flex items-center justify-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5 ${
          large ? "h-8 w-8" : "h-7 w-7"
        }`}
      >
        <ArrowRight size={large ? 15 : 13} />
      </span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </div>
  );
}

function BentoCell({
  icon: Icon,
  title,
  children,
  className = "",
  big,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={`flex flex-col p-6 transition-colors hover:bg-off/50 ${className}`}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-off text-ink">
        <Icon size={17} strokeWidth={1.7} />
      </div>
      <h3 className={`tracking-tight ${big ? "font-serif text-[24px]" : "text-[15px] font-semibold"}`}>{title}</h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-4 text-[13px] font-semibold text-ink">{title}</div>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-muted transition-colors hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ graphics */
function WorkflowGraphic() {
  const nodes = [
    { label: "Create Wallet", sub: "Friendbot funded", dot: "#1a6cf2" },
    { label: "Send Payment", sub: "25 USDC", dot: "#16a34a" },
    { label: "Verify Transaction", sub: "on-chain ✓", dot: "#7c3aed" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.4)]">
      <div className="mb-4 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div
        className="flex flex-col items-center gap-0 rounded-xl p-4"
        style={{ backgroundImage: "radial-gradient(#e6e4dc 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      >
        {nodes.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center">
            <div className="flex w-56 items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.dot }} />
              <div>
                <div className="text-[13px] font-medium text-ink">{n.label}</div>
                <div className="text-[11px] text-muted">{n.sub}</div>
              </div>
            </div>
            {i < nodes.length - 1 && <div className="h-5 w-px bg-border" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniFlow() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      {["Trigger", "Wallet", "Pay", "Verify"].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-off px-2.5 py-1 font-medium text-ink">{s}</span>
          {i < 3 && <span className="text-border">→</span>}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- content */
const STEPS = [
  { title: "Describe or drag", body: "Type a prompt or drag blocks onto the canvas to start your flow." },
  { title: "Configure", body: "Set amounts, assets, and destinations in the inspector. Reuse saved wallets." },
  { title: "Run on testnet", body: "Execute for real and watch live logs stream into the console." },
  { title: "Export & ship", body: "Download production-ready code or schedule it to run later." },
];

const WHO = [
  { title: "Developers", body: "Skip boilerplate. Prototype Stellar apps 10× faster and export clean code.", bg: "#ffffff" },
  { title: "Students", body: "Learn blockchain concepts visually before diving into Rust or the SDK.", bg: "#eef3fe" },
  { title: "Hackathon teams", body: "Ship a working Stellar demo in hours, not days. Less debugging SDKs.", bg: "#f5ece5" },
];
