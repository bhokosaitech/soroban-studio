/**
 * Ephemeral per-run signers (vault wallet secrets), held in memory only between
 * the POST that creates a run and the SSE stream that executes it. Never written
 * to the database. Cleared on consume, with a TTL sweep as a backstop.
 *
 * This lives in its own module (not a route file) because the create and stream
 * Route Handlers are separate modules and must share the same in-memory Map.
 * Single-process only — entries do not survive a restart, matching prior behavior.
 */
export interface PendingSigner {
  signers?: Record<string, string>;
  nodeSecrets?: Record<string, string>;
  at: number;
}

const SIGNER_TTL_MS = 5 * 60_000;

const globalForSigners = globalThis as unknown as {
  __pendingSigners?: Map<string, PendingSigner>;
};

const pendingSigners: Map<string, PendingSigner> =
  globalForSigners.__pendingSigners ?? new Map();
globalForSigners.__pendingSigners = pendingSigners;

function sweep() {
  const now = Date.now();
  for (const [id, v] of pendingSigners) {
    if (now - v.at > SIGNER_TTL_MS) pendingSigners.delete(id);
  }
}

export function stashSigners(runId: string, entry: Omit<PendingSigner, "at">): void {
  sweep();
  pendingSigners.set(runId, { ...entry, at: Date.now() });
}

/** Read and remove a run's signers (single consumer). */
export function consumeSigners(runId: string): PendingSigner | undefined {
  const entry = pendingSigners.get(runId);
  pendingSigners.delete(runId);
  return entry;
}
