"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  CalendarClock,
  Code2,
  KeyRound,
  Sparkles,
  Zap,
} from "lucide-react";

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={1.7}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function TwitterIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={1.7}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function LinkedinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={1.7}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
import { Logo } from "@/components/site/Logo";
import {
  StellarMark,
  SorobanMark,
  HorizonMark,
  ReactMark,
  DeepSeekMark,
  RedisMark,
} from "@/components/site/BrandMarks";

const NAV_LINKS: [string, string][] = [
  ["Features", "#features"],
  ["How it works", "#how"],
  ["Who it's for", "#who"],
];

export default function LandingPage() {
  const [playDemo, setPlayDemo] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-off text-ink">
      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 border-b border-l border-r border-border/70 bg-off/10 backdrop-blur-sm">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[14px] text-muted transition-colors hover:text-ink"
              >
                {label}
              </a>
            ))}
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
        <section className="relative overflow-hidden">
          {/* Cinematic backdrop: drifting aurora + film grain, confined to the hero. */}
          <div aria-hidden className="grain pointer-events-none absolute inset-0 z-0">
            <div className="aurora" />
          </div>

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-44 pb-20 text-center">
            <div className="reveal mb-8 inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/70 px-3.5 py-1.5 text-[13px] text-muted backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent pulse" />
              n8n for Stellar &amp; Soroban
            </div>

            <h1 className="display text-[3rem] lg:text-[5rem]">
              Build Stellar apps,
              <span className="text-gradient italic">visually.</span>
            </h1>

            <p className="mt-8 max-w-xl text-[19px] leading-relaxed text-muted mb-6">
              Drag-and-drop workflows become real, on-chain apps, test on testnet and
              export to production-ready code.
            </p>

            <ArrowButton href="/editor" large>Launch Studio</ArrowButton>
          </div>
        </section>

        {/* DEMO VIDEO SECTION */}
        <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20">
          <div className="reveal overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.15)] transition-all duration-300 hover:shadow-[0_45px_100px_-50px_rgba(26,108,242,0.3)]">
            {playDemo ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  src="https://www.youtube.com/embed/YTBFQ-v_unQ?autoplay=1"
                  title="Soroban Studio Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            ) : (
              <button
                onClick={() => setPlayDemo(true)}
                className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-off/50 text-left focus:outline-none"
                style={{
                  backgroundImage: "radial-gradient(#e4e2db 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              >
                {/* Simulated Editor Canvas as background */}
                <div className="absolute inset-0 flex items-center justify-center opacity-40 transition-opacity group-hover:opacity-50">
                  {/* Floating blocks */}
                  <div className="flex flex-col items-center gap-5">
                    <div className="flex w-48 items-center gap-3 rounded-lg border border-border/80 bg-white px-3.5 py-3 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      <div>
                        <div className="text-[11px] font-medium text-ink">Create Wallet</div>
                        <div className="text-[9px] text-muted">Friendbot funded</div>
                      </div>
                    </div>
                    <div className="h-6 w-px border-l-2 border-dashed border-border" />
                    <div className="flex w-48 items-center gap-3 rounded-lg border border-border/80 bg-white px-3.5 py-3 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <div className="text-[11px] font-medium text-ink">Send Payment</div>
                        <div className="text-[9px] text-muted">10 XLM</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dark blur overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-ink/10 to-transparent" />
                <div className="absolute inset-0 bg-ink/10 backdrop-blur-[2px] transition-all group-hover:bg-ink/20 group-hover:backdrop-blur-none" />

                {/* Centered Play Button & Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform duration-300 group-hover:scale-110">
                    {/* Pulsing ring */}
                    <span className="absolute -inset-3 rounded-full border border-white/30 bg-white/5 opacity-0 group-hover:animate-ping group-hover:opacity-100" />
                    
                    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  
                  <div className="text-center">
                    <span className="rounded-full bg-ink px-3.5 py-1 text-[12px] font-medium text-white shadow-sm">
                      Watch Demo
                    </span>
                    <p className="mt-2 text-[13px] font-medium text-ink/80">
                      See Soroban Studio build a workflow in 2 minutes
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </section>

        {/* BUILT ON — hairline grid row with brand logos */}
        <section id="built" className="mx-auto max-w-6xl px-6 py-14">
          <div className="reveal mb-6 flex items-center justify-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built on proven infrastructure
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6 [&>*]:bg-white">
              {BUILT_ON.map(({ name, Icon }) => (
                <div
                  key={name}
                  className="group flex items-center justify-center gap-2.5 px-4 py-7 text-[13px] font-medium text-muted transition-colors hover:text-ink"
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted/70 transition-colors group-hover:text-ink" />
                  {name}
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
              <h2 className="reveal mt-2 max-w-lg display text-[clamp(2.2rem,4.6vw,3.5rem)]">
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
          <h2 className="reveal mt-2 max-w-lg display text-[clamp(2.2rem,4.6vw,3.5rem)]">
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
        <section id="who" className="mx-auto max-w-6xl px-6 py-16">
          <SectionLabel>Who it&apos;s for</SectionLabel>
          <h2 className="reveal mt-2 max-w-lg display text-[clamp(2.2rem,4.6vw,3.5rem)]">
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
          <div className="relative overflow-hidden rounded-3xl border border-border bg-white px-8 py-20 text-center">
            <div aria-hidden className="grain pointer-events-none absolute inset-0">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(50% 90% at 50% 0%, rgba(26,108,242,0.14), transparent 70%)",
                }}
              />
            </div>
            <div className="relative z-10">
              <h2 className="display text-[2.5rem]  lg:text-[3rem]">
                Start building on <span className="text-gradient">Stellar.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[16px] text-muted">
                Open the editor and assemble your first real workflow. No setup, no signup.
              </p>
              <div className="mt-9 flex justify-center">
                <ArrowButton href="/editor" large>
                  Launch the editor
                </ArrowButton>
              </div>
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
              <div className="mt-6 flex items-center gap-4">
                <a
                  href="https://github.com/bhokosaitech/soroban-studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                  aria-label="GitHub"
                >
                  <GithubIcon size={18} />
                </a>
                <a
                  href="https://x.com/jaykosai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                  aria-label="Twitter"
                >
                  <TwitterIcon size={18} />
                </a>
                <a
                  href="https://www.linkedin.com/in/jaykosai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                  aria-label="LinkedIn"
                >
                  <LinkedinIcon size={18} />
                </a>
              </div>
            </div>
            <FooterCol title="Product" links={[["Editor", "/editor"], ["Dashboard", "/dashboard"], ["Features", "#features"]]} />
            <FooterCol title="Project" links={[["How it works", "#how"], ["Testnet Explorer", "https://stellar.expert/testnet/public"], ["Open source", "https://github.com/bhokosaitech/soroban-studio"]]} />
          </div>
          <div className="mx-auto max-w-6xl px-6 pb-8">
            <p className="font-mono text-[12px] text-muted">
              © 2026 Soroban Studio
            </p>
          </div>
        </footer>
      </div>
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
      className={`group inline-flex items-center gap-2.5 rounded-full bg-ink font-medium text-white transition-colors hover:bg-black ${large ? "py-1.5 pl-6 pr-1.5 text-[15px]" : "py-1 pl-4 pr-1 text-[13px]"
        }`}
    >
      {children}
      <span
        className={`flex items-center justify-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5 ${large ? "h-8 w-8" : "h-7 w-7"
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
    <div className={`flex flex-col p-6 transition-colors  ${className}`}>
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
        {links.map(([label, href]) => {
          const isHashOrExternal = href.startsWith("#") || href.startsWith("http");
          return (
            <li key={label}>
              {isHashOrExternal ? (
                <a href={href} className="text-[13px] text-muted transition-colors hover:text-ink">
                  {label}
                </a>
              ) : (
                <Link href={href} className="text-[13px] text-muted transition-colors hover:text-ink">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
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
const BUILT_ON = [
  { name: "Stellar SDK", Icon: StellarMark },
  { name: "Soroban RPC", Icon: SorobanMark },
  { name: "Horizon", Icon: HorizonMark },
  { name: "React Flow", Icon: ReactMark },
  { name: "DeepSeek", Icon: DeepSeekMark },
  { name: "Redis · BullMQ", Icon: RedisMark },
];

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
