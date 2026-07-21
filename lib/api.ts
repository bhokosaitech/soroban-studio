import type { Workflow } from "@/lib/workflow";
import type { RunLog } from "@/lib/soroban/sandbox";

/**
 * Base URL of the execution API. Empty by default so all calls hit the
 * same-origin Next.js route handlers (`/api/...`). Set NEXT_PUBLIC_API_URL only
 * to point the UI at a different host.
 */
export const API_URL = "";
const STREAM_API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export class BackendUnavailableError extends Error {
  constructor() {
    super("backend-unavailable");
    this.name = "BackendUnavailableError";
  }
}

export interface RunSecrets {
  signers?: Record<string, string>;
  nodeSecrets?: Record<string, string>;
}

/** A wallet generated during a run — its secret is delivered to the client only. */
export interface CreatedWallet {
  publicKey: string;
  secret: string;
  network: string;
  label: string;
}

/** Create a run on the backend and return its id. */
async function createRun(workflow: Workflow, secrets?: RunSecrets): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow, signers: secrets?.signers, nodeSecrets: secrets?.nodeSecrets }),
    });
  } catch {
    throw new BackendUnavailableError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Run creation failed (${res.status}).`);
  }
  const data = (await res.json()) as { runId: string };
  return data.runId;
}

/**
 * Execute a workflow on the real backend, streaming logs via SSE.
 * Resolves with the final status. Throws BackendUnavailableError if the server
 * can't be reached (so the caller can fall back to the local simulation).
 */
export async function runWorkflowLive(
  workflow: Workflow,
  onLog: (log: RunLog) => void,
  secrets?: RunSecrets,
  onWallet?: (wallet: CreatedWallet) => void
): Promise<"succeeded" | "failed"> {
  const runId = await createRun(workflow, secrets);

  return new Promise((resolve, reject) => {
    const es = new EventSource(`${STREAM_API_URL}/api/runs/${runId}/stream`);
    let sawAnyEvent = false;

    es.addEventListener("log", (e) => {
      sawAnyEvent = true;
      try {
        onLog(JSON.parse((e as MessageEvent).data) as RunLog);
      } catch {
        /* ignore malformed frame */
      }
    });

    es.addEventListener("wallet", (e) => {
      sawAnyEvent = true;
      try {
        onWallet?.(JSON.parse((e as MessageEvent).data) as CreatedWallet);
      } catch {
        /* ignore malformed frame */
      }
    });

    es.addEventListener("done", (e) => {
      es.close();
      try {
        const { status } = JSON.parse((e as MessageEvent).data) as {
          status: "succeeded" | "failed";
        };
        resolve(status);
      } catch {
        resolve("succeeded");
      }
    });

    es.onerror = () => {
      es.close();
      // If we never received a single event, the stream never opened.
      if (!sawAnyEvent) reject(new BackendUnavailableError());
      else resolve("failed");
    };
  });
}

export function isBackendUnavailable(e: unknown): e is BackendUnavailableError {
  return e instanceof BackendUnavailableError;
}

export interface SavedProject {
  id: string;
  name: string;
  description?: string | null;
  network: string;
  updatedAt: string;
  workflow: Workflow;
}

/**
 * Persist a workflow. Pass `id` to update an existing project, omit it to create
 * one. Returns the saved project (with its id) so the caller can keep updating it.
 */
export async function saveProject(workflow: Workflow, id?: string | null): Promise<SavedProject> {
  const res = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workflow, id: id ?? undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not save project.");
  }
  return res.json();
}

/** Fetch one of the user's saved projects by id. */
export async function fetchProject(id: string): Promise<SavedProject> {
  const res = await fetch(`${API_URL}/api/projects/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load project.");
  }
  return res.json();
}

/** Create + fund a testnet wallet whose secret is returned (not stored server-side). */
export async function createEphemeralWallet(): Promise<{
  publicKey: string;
  secret: string;
  network: string;
}> {
  const res = await fetch(`${API_URL}/api/wallets/ephemeral`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not create wallet.");
  }
  return res.json();
}

export interface Schedule {
  id: string;
  name: string;
  runAt: string;
  status: string;
  lastRunId?: string | null;
  createdAt: string;
}

/** Schedule a workflow to run at `runAt` (ISO string). */
export async function scheduleWorkflow(
  workflow: Workflow,
  runAt: string
): Promise<Schedule & { mode: string }> {
  const res = await fetch(`${API_URL}/api/schedules`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workflow, runAt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not schedule workflow.");
  }
  return res.json();
}

export async function listSchedules(): Promise<{ mode: string; schedules: Schedule[] }> {
  const res = await fetch(`${API_URL}/api/schedules`);
  if (!res.ok) throw new Error("Could not load schedules.");
  return res.json();
}

export async function cancelScheduleReq(id: string): Promise<void> {
  await fetch(`${API_URL}/api/schedules/${id}`, { method: "DELETE" });
}

export type ShareMode = "readonly" | "fork";

export interface ShareInfo {
  slug: string;
  mode: ShareMode;
  revoked: boolean;
  authorName?: string | null;
}

/** Fetch the given project's active share link, or null if it hasn't been shared. */
export async function getProjectShare(projectId: string): Promise<ShareInfo | null> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/share`);
  if (!res.ok) throw new Error("Could not load share status.");
  const data = (await res.json()) as { share: ShareInfo | null };
  return data.share;
}

/** Publish the project (or return its existing link) in the given access mode. */
export async function createProjectShare(projectId: string, mode: ShareMode): Promise<ShareInfo> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not create share link.");
  }
  const data = (await res.json()) as { share: ShareInfo };
  return data.share;
}

/** Change a project's share mode, or revoke its link. */
export async function updateProjectShare(
  projectId: string,
  patch: { mode?: ShareMode; revoked?: boolean }
): Promise<ShareInfo> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/share`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not update share link.");
  }
  const data = (await res.json()) as { share: ShareInfo };
  return data.share;
}

export interface SharedWorkflow {
  slug: string;
  name: string;
  description?: string | null;
  network: string;
  workflow: Workflow;
  mode: ShareMode;
  authorName?: string | null;
  createdAt: string;
}

/** Fetch a shared workflow snapshot by its public slug (no auth required). */
export async function fetchShare(slug: string): Promise<SharedWorkflow> {
  const res = await fetch(`${API_URL}/api/shares/${slug}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load this share link.");
  }
  return res.json();
}

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Fork a shared workflow into the signed-in user's own workspace. Returns the new project id. */
export async function forkShare(slug: string): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/api/shares/${slug}/fork`, { method: "POST" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not fork this workflow.");
  }
  return res.json();
}
