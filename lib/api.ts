import type { Workflow } from "@/lib/workflow";
import type { RunLog } from "@/lib/soroban/sandbox";

/**
 * Base URL of the execution API. Empty by default so all calls hit the
 * same-origin Next.js route handlers (`/api/...`). Set NEXT_PUBLIC_API_URL only
 * to point the UI at a different host.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

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
  secrets?: RunSecrets
): Promise<"succeeded" | "failed"> {
  const runId = await createRun(workflow, secrets);

  return new Promise((resolve, reject) => {
    const es = new EventSource(`${API_URL}/api/runs/${runId}/stream`);
    let sawAnyEvent = false;

    es.addEventListener("log", (e) => {
      sawAnyEvent = true;
      try {
        onLog(JSON.parse((e as MessageEvent).data) as RunLog);
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
