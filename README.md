# Soroban Studio

A visual development environment for building **Stellar / Soroban** applications with
drag-and-drop workflows and AI-assisted generation — then exporting production-ready code.

Assemble apps from Stellar-native blocks (Create Wallet, Send Payment, Invoke Contract,
Wait for Payment, Trigger Webhook, …), test them in a sandbox, and export runnable
JavaScript (`@stellar/stellar-sdk`) and a Soroban Rust contract skeleton.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4**
- **React Flow** (`@xyflow/react`) — the node-based visual editor
- **Zustand** — editor state / workflow store
- **@stellar/stellar-sdk** — Stellar/Soroban integration + code export target
- **DeepSeek** — AI Builder (prompt → workflow), with a keyless heuristic fallback

## Getting started

This is a two-part app: the **web app** (this folder) and the **execution backend**
(`server/`). The editor works on its own; the backend is what makes **Run** submit
real transactions to Stellar testnet.

### 1. Web app

```bash
npm install
cp .env.example .env.local   # optional: DEEPSEEK_API_KEY, NEXT_PUBLIC_API_URL
npm run dev                  # http://localhost:3000
```

### 2. Execution backend (real testnet runs)

```bash
cd server
npm install
cp .env.example .env         # SQLite by default — no database server needed
npm run setup                # prisma migrate: creates the local SQLite db
npm run dev                  # http://localhost:4000
```

With both running, the editor's **Run** button executes your workflow on real
Stellar **testnet** and streams live logs (funded wallets, real tx hashes,
explorer links) into the console. If the backend is down, Run falls back to a
local simulation and tells you.

Routes:

- `/` — marketing landing page
- `/dashboard` — templates + workspace
- `/editor` — the visual workflow editor (`?template=<id>` seeds a starter)

An in-app **step-by-step guide** opens on first visit to the editor (reopen it
anytime from the **Guide** button, bottom-right).

## Architecture

```
app/
  page.tsx              Landing page
  dashboard/page.tsx    Templates + workspace
  editor/page.tsx       Visual editor (renders <EditorApp/>)
  api/generate/route.ts AI Builder endpoint (prompt -> workflow JSON)

components/
  site/                 Landing/nav/waitlist components
  editor/               Canvas, BlockPalette, Inspector, Toolbar, RunConsole,
                        AIBuilder, ExportDialog, custom BlockNode

lib/
  blocks/               Block catalog (single source of truth for the editor,
                        inspector, AI prompt, and codegen)
  workflow/             Portable Workflow JSON schema + (de)serialization,
                        validation, topological execution order
  store/editor.ts       Zustand editor store (React Flow <-> Workflow)
  soroban/              Network config + (simulated) sandbox runtime
  ai/                   DeepSeek client + heuristic fallback + system prompt
  codegen/              JavaScript + Rust (Soroban) generators
  templates.ts          Starter templates
```

### The block catalog is the source of truth

Everything derives from `lib/blocks/catalog.ts`: the palette, node rendering, the
inspector form, the AI system prompt, sandbox execution, and code generation. Adding a
new block is a single catalog entry (plus optional codegen/sandbox snippets).

### Workflow JSON

The editor graph serializes to a stable, tool-agnostic `Workflow` (`lib/workflow/types.ts`).
This is what gets saved, produced by the AI Builder, validated before a run, and fed to
the code generators.

## The backend (`server/`)

Node + TypeScript + Express + Prisma. Executes workflows for real against Stellar
testnet and streams logs over SSE.

```
server/
  prisma/schema.prisma   Project, Wallet, Run, RunLog (SQLite by default)
  src/
    stellar/             network config, asset resolver, real operations
    engine/              executor (topological run) + per-block handlers
    routes/              runs (+SSE stream), projects, wallets
    index.ts             Express app
```

- **Custodial testnet keys:** to run a whole workflow automatically, the backend
  generates and stores testnet keypairs so it can sign. **Testnet only** — never
  point `STELLAR_NETWORK` at mainnet with custodied keys.
- **SQLite by default** (a local file) so there's no database server to run.
  Switch to Postgres by changing the provider in `prisma/schema.prisma`.

### What's real vs. simulated

| Block | Real on testnet? |
|---|---|
| Create Wallet, Connect Wallet | ✅ keypair + Friendbot funding |
| Send Payment, Add Trustline | ✅ signed + submitted to Horizon |
| Generate Address (muxed) | ✅ real SEP-23 M-address |
| Wait for Payment | ✅ polls Horizon for the incoming payment |
| Verify Transaction | ✅ reads the tx result from Horizon |
| Create Invoice | ✅ real SEP-7 `web+stellar:pay` URI |
| Trigger Webhook, Delay, Condition | ✅ real |
| Invoke / Deploy Contract | ⚠️ connects to Soroban RPC; full invoke needs your contract + args |
| Confidential Transfer, Swap | ⚠️ simulated — needs a deployed contract / on-chain liquidity |

Accuracy note: Stellar has no protocol-level shielded pool (unlike Zcash).
**Confidential Transfer** maps to an encrypted-balance (confidential-token) Soroban
contract, not a built-in privacy layer — so it's honestly labeled as needing your
own deployed contract rather than faking success.

## Scheduling & the wallet vault

**Scheduled runs (Redis).** The **Schedule** button in the editor runs a workflow
automatically at a chosen date/time. Backend uses **BullMQ** delayed jobs on Redis
when available (`redis-server`), and automatically falls back to an in-process DB
poller when Redis isn't reachable — the `Schedule` row is the source of truth either
way. Set `REDIS_URL` to point at a specific instance.

**Encrypted wallet vault (client-side).** The **Wallets** button opens a vault that
generates + funds testnet wallets and stores them **encrypted in the browser**
(localStorage) so they're reusable across workflows:

- Password → key via **PBKDF2** (SHA-256, 210k iterations) → **AES-256-GCM**.
- Only `{salt, iv, ciphertext}` is stored; the password is never persisted, and
  secrets never reach the server.
- `POST /api/wallets/ephemeral` funds a wallet and returns the secret **without**
  storing it — the browser encrypts it locally.
- Use a saved wallet in a flow via the **Use Saved Wallet** block. At run time the
  client decrypts the chosen secret and passes it to the backend as an **ephemeral
  signer** (held in memory for that run only, never written to the DB).

## Status / next steps

- [x] Project scaffold, design system, landing migration
- [x] Visual editor (palette, canvas, inspector, JSON serialization)
- [x] AI Builder (DeepSeek + heuristic fallback)
- [x] JS/Rust/JSON export
- [x] **Real testnet execution backend** with live SSE streaming
- [x] Interactive step-by-step onboarding guide
- [x] **Scheduled runs** via Redis/BullMQ (with DB-poller fallback)
- [x] **Encrypted wallet vault** (PBKDF2 + AES-GCM, localStorage) + reuse in flows
- [ ] Freighter (browser wallet) signing as an alternative to custodial keys
- [ ] Full Soroban contract invoke (encoded args + signing)
- [ ] Recurring (cron) schedules
- [ ] Wire dashboard "Recent projects" to the backend's project persistence
