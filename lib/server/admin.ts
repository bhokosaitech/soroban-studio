import { prisma } from "./db";

/**
 * Read-only aggregates for the admin dashboard. Everything here runs on the
 * server (admin-gated) and touches the DB directly — no secrets are ever
 * returned (wallet `secret` is never selected).
 */

export interface AdminOverview {
  users: number;
  usersLast7d: number;
  projects: number;
  projectsLast7d: number;
  runs: number;
  runsLast7d: number;
  runsSucceeded: number;
  runsFailed: number;
  runsRunning: number;
  successRate: number | null; // 0..100 over finished runs, null if none
  schedulesScheduled: number;
  wallets: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  projectCount: number;
}

export interface AdminProjectRow {
  id: string;
  name: string;
  network: string;
  createdAt: Date;
  updatedAt: Date;
  ownerEmail: string | null;
  runCount: number;
}

export interface AdminRunRow {
  id: string;
  status: string;
  network: string;
  createdAt: Date;
  finishedAt: Date | null;
  projectName: string | null;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const since = daysAgo(7);
  const [
    users,
    usersLast7d,
    projects,
    projectsLast7d,
    runs,
    runsLast7d,
    runsSucceeded,
    runsFailed,
    runsRunning,
    schedulesScheduled,
    wallets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.project.count(),
    prisma.project.count({ where: { createdAt: { gte: since } } }),
    prisma.run.count(),
    prisma.run.count({ where: { createdAt: { gte: since } } }),
    prisma.run.count({ where: { status: "succeeded" } }),
    prisma.run.count({ where: { status: "failed" } }),
    prisma.run.count({ where: { status: "running" } }),
    prisma.schedule.count({ where: { status: "scheduled" } }),
    prisma.wallet.count(),
  ]);

  const finished = runsSucceeded + runsFailed;
  const successRate = finished > 0 ? Math.round((runsSucceeded / finished) * 100) : null;

  return {
    users,
    usersLast7d,
    projects,
    projectsLast7d,
    runs,
    runsLast7d,
    runsSucceeded,
    runsFailed,
    runsRunning,
    successRate,
    schedulesScheduled,
    wallets,
  };
}

export async function getRecentUsers(take = 25): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { projects: true } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
    projectCount: u._count.projects,
  }));
}

export async function getRecentProjects(take = 25): Promise<AdminProjectRow[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      network: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { email: true } },
      _count: { select: { runs: true } },
    },
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    network: p.network,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ownerEmail: p.owner?.email ?? null,
    runCount: p._count.runs,
  }));
}

export async function getRecentRuns(take = 25): Promise<AdminRunRow[]> {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      status: true,
      network: true,
      createdAt: true,
      finishedAt: true,
      project: { select: { name: true } },
    },
  });
  return runs.map((r) => ({
    id: r.id,
    status: r.status,
    network: r.network,
    createdAt: r.createdAt,
    finishedAt: r.finishedAt,
    projectName: r.project?.name ?? null,
  }));
}
