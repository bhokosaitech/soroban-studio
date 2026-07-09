import Link from "next/link";
import { ArrowRight, Clock, Plus, Sparkles } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { LogoutButton } from "@/components/site/LogoutButton";
import { TEMPLATES } from "@/lib/templates";
import { requireUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, description: true, network: true, updatedAt: true },
  });

  return (
    <div className="min-h-screen bg-off">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <LogoutButton />
            <Link href="/editor" className="btn-dark flex items-center gap-1.5">
              <Plus size={15} /> New workflow
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Hero row */}
        <div className="mb-10 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-white p-7 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-serif text-2xl tracking-tight text-ink">Your workspace</h1>
            <p className="mt-1 text-[14px] text-muted">
              Start from a template, or describe your app and let the AI Builder assemble it.
            </p>
          </div>
          <Link
            href="/editor"
            className="btn-outline flex items-center gap-2 self-start sm:self-auto"
          >
            <Sparkles size={15} className="text-accent" /> Build with AI
          </Link>
        </div>

        {/* Templates */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Templates
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Link
              key={t.id}
              href={`/editor?template=${t.id}`}
              className="group flex flex-col justify-between rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-ink">{t.name}</h3>
                  <ArrowRight
                    size={16}
                    className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-muted">{t.description}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-off px-2 py-0.5 text-[11px] font-medium text-muted"
                  >
                    {tag}
                  </span>
                ))}
                <span className="rounded-full bg-off px-2 py-0.5 text-[11px] font-medium text-muted">
                  {t.blocks.length} blocks
                </span>
              </div>
            </Link>
          ))}

          {/* Blank canvas */}
          <Link
            href="/editor"
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white/50 p-5 text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <Plus size={22} />
            <span className="text-[14px] font-medium">Blank canvas</span>
          </Link>
        </div>

        {/* Recent projects */}
        <div className="mt-12">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Recent projects
          </h2>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
              <p className="text-[14px] text-muted">
                No saved projects yet. Anything you build in the editor is saved here
                automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/editor?project=${p.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
                      <ArrowRight
                        size={16}
                        className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    </div>
                    {p.description && (
                      <p className="mt-1.5 text-[13px] leading-snug text-muted">{p.description}</p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-muted">
                    <span className="rounded-full bg-off px-2 py-0.5 font-medium">{p.network}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {p.updatedAt.toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
