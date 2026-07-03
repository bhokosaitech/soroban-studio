<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Soroban Studio — project notes

Visual editor for Stellar/Soroban apps (drag-and-drop workflows → exportable code).
Stack: Next.js 16 App Router, React 19, TS, Tailwind v4, React Flow (`@xyflow/react`),
Zustand, `@stellar/stellar-sdk`, DeepSeek (AI Builder).

**The block catalog (`lib/blocks/catalog.ts`) is the single source of truth.** The palette,
node rendering, inspector form, AI system prompt, sandbox runtime, and code generators all
read from it. To add a workflow step, add one `BlockDefinition` (then optional codegen +
sandbox snippets keyed by block `type`).

Key layers:
- `lib/workflow/` — portable `Workflow` JSON schema, serialize/validate, topo order.
- `lib/store/editor.ts` — Zustand store bridging React Flow graph ⇄ `Workflow`.
- `lib/api.ts` — calls the backend; `runWorkflowLive` streams a real run via SSE and
  falls back to `lib/soroban/sandbox.ts` (local simulation) if the backend is down.
- `lib/ai/` — DeepSeek client with a keyless heuristic fallback (`fallback.ts`).
- `lib/codegen/` — JS (`@stellar/stellar-sdk`) + Soroban Rust generators.

**Two processes:** the Next.js app (this folder) + the execution backend in `server/`
(Express + Prisma + SQLite). The backend runs workflows for REAL on Stellar testnet
(`server/src/engine/handlers.ts` = per-block real logic) and streams logs over SSE
(`/api/runs/:id/stream`). It custodies testnet-only keypairs to sign. Confidential
Transfer / contract deploy stay simulated (need a deployed contract) — keep that honest.

The editor has an onboarding tour: `components/editor/Guide.tsx` driven by `data-guide`
attributes on target elements; the overlay is `pointer-events-none` so it never blocks
interaction (auto-advances on node/edge add).

Scheduling: `server/src/scheduler/` — BullMQ/Redis when reachable, else a DB poller;
`Schedule` row is source of truth. Editor: `ScheduleDialog.tsx` + `/api/schedules`.

Wallet vault (client-only): `lib/vault/crypto.ts` (PBKDF2 + AES-GCM) + `lib/vault/store.ts`
(zustand + localStorage; password in memory only). Secrets are encrypted in the browser
and never persisted server-side. To reuse a saved wallet in a run, the client decrypts it
and sends it as an ephemeral signer (`signers` on POST /api/runs, held in memory only —
see `pendingSigners` in `server/src/routes/runs.ts`). Block: `use-wallet`.

Accuracy: Stellar has no protocol-level shielded pool. "Confidential Transfer" = an
encrypted-balance Soroban token contract, not a built-in privacy feature. Keep naming
honest (it's Stellar/Soroban, not a Zcash-style privacy chain).
