import Link from "next/link";
import {
  Users,
  FolderKanban,
  PlayCircle,
  CalendarClock,
  Wallet,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { requireAdmin } from "@/lib/server/auth";
import {
  getAdminOverview,
  getRecentProjects,
  getRecentRuns,
  getRecentUsers,
} from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");
  const [overview, users, projects, runs] = await Promise.all([
    getAdminOverview(),
    getRecentUsers(),
    getRecentProjects(),
    getRecentRuns(),
  ]);

  return (
    <div className="min-h-screen bg-off">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full border border-border bg-off px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4 text-[13px] text-muted">
            <span className="hidden sm:inline">{admin.email}</span>
            <Link href="/dashboard" className="btn-outline">
              Exit to app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl tracking-tight text-ink">Site overview</h1>
          <p className="mt-1 text-[14px] text-muted">
            Read-only monitoring of users, projects, and workflow runs.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} label="Users" value={overview.users} sub={`+${overview.usersLast7d} in 7d`} />
          <Stat
            icon={FolderKanban}
            label="Projects"
            value={overview.projects}
            sub={`+${overview.projectsLast7d} in 7d`}
          />
          <Stat icon={PlayCircle} label="Runs" value={overview.runs} sub={`+${overview.runsLast7d} in 7d`} />
          <Stat
            icon={CheckCircle2}
            label="Run success rate"
            value={overview.successRate === null ? "—" : `${overview.successRate}%`}
            sub={`${overview.runsSucceeded} ok · ${overview.runsFailed} failed`}
          />
          <Stat
            icon={PlayCircle}
            label="Running now"
            value={overview.runsRunning}
            sub="in-flight executions"
          />
          <Stat
            icon={CalendarClock}
            label="Scheduled"
            value={overview.schedulesScheduled}
            sub="pending schedules"
          />
          <Stat icon={Wallet} label="Wallets" value={overview.wallets} sub="testnet keypairs" />
        </div>

        {/* Users */}
        <Section title="Recent users" count={overview.users}>
          <Table head={["Email", "Name", "Projects", "Joined"]}>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <Td mono>{u.email}</Td>
                <Td>{u.name ?? <span className="text-muted">—</span>}</Td>
                <Td>{u.projectCount}</Td>
                <Td>{fmt(u.createdAt)}</Td>
              </tr>
            ))}
            {users.length === 0 && <EmptyRow cols={4} label="No users yet." />}
          </Table>
        </Section>

        {/* Projects */}
        <Section title="Recent projects" count={overview.projects}>
          <Table head={["Name", "Owner", "Network", "Runs", "Updated"]}>
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <Td>{p.name}</Td>
                <Td mono>{p.ownerEmail ?? <span className="text-muted">—</span>}</Td>
                <Td>
                  <Badge>{p.network}</Badge>
                </Td>
                <Td>{p.runCount}</Td>
                <Td>{fmt(p.updatedAt)}</Td>
              </tr>
            ))}
            {projects.length === 0 && <EmptyRow cols={5} label="No projects yet." />}
          </Table>
        </Section>

        {/* Runs */}
        <Section title="Recent runs" count={overview.runs}>
          <Table head={["Run", "Project", "Status", "Network", "Started", "Finished"]}>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <Td mono>{r.id.slice(0, 8)}…</Td>
                <Td>{r.projectName ?? <span className="text-muted">ad-hoc</span>}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td>
                  <Badge>{r.network}</Badge>
                </Td>
                <Td>{fmt(r.createdAt)}</Td>
                <Td>{r.finishedAt ? fmt(r.finishedAt) : <span className="text-muted">—</span>}</Td>
              </tr>
            ))}
            {runs.length === 0 && <EmptyRow cols={6} label="No runs yet." />}
          </Table>
        </Section>

        <p className="mt-10 flex items-center gap-1.5 text-[12px] text-muted">
          <ExternalLink size={12} />
          Wallet secrets are never shown here. This view is read-only.
        </p>
      </main>
    </div>
  );
}

/* ----------------------------------------------------------- UI pieces */
function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={16} className="text-accent" />
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <div className="mt-3 font-serif text-[28px] leading-none tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-border">
          {count} total
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <thead>
        <tr className="text-[12px] uppercase tracking-wide text-muted">
          {head.map((h) => (
            <th key={h} className="px-4 py-3 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-3 align-middle text-ink ${mono ? "font-mono text-[12px]" : ""}`}>{children}</td>;
}

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr className="border-t border-border">
      <td colSpan={cols} className="px-4 py-8 text-center text-[13px] text-muted">
        {label}
      </td>
    </tr>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-off px-2 py-0.5 text-[11px] font-medium text-muted">{children}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-green-50 text-green-700 ring-green-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
    running: "bg-blue-50 text-blue-700 ring-blue-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  const cls = map[status] ?? "bg-off text-muted ring-border";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ${cls}`}>
      {status}
    </span>
  );
}

function fmt(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
