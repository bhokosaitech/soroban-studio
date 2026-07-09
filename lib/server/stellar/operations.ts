import {
  BASE_FEE,
  Keypair,
  Memo,
  MuxedAccount,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { NETWORK, horizon } from "./network.js";
import { isNative, resolveAsset } from "./assets.js";

/** Fund an account with test XLM via Friendbot. Idempotent-ish on testnet. */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`${NETWORK.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    const body = await res.text();
    // Already-funded accounts return 400 — treat as non-fatal.
    if (!body.includes("op_already_exists") && res.status !== 400) {
      throw new Error(`Friendbot failed (${res.status})`);
    }
  }
}

/** Generate a new keypair and fund it on testnet. */
export async function createFundedKeypair(): Promise<Keypair> {
  const kp = Keypair.random();
  await fundWithFriendbot(kp.publicKey());
  return kp;
}

export interface PaymentInput {
  source: Keypair;
  destination: string;
  assetCode?: string;
  amount: string;
  memo?: string;
}

/** Build, sign, and submit a classic payment. Returns the tx hash. */
export async function sendPayment(input: PaymentInput): Promise<string> {
  const account = await horizon.loadAccount(input.source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  }).addOperation(
    Operation.payment({
      destination: input.destination,
      asset: resolveAsset(input.assetCode),
      amount: normalizeAmount(input.amount),
    })
  );

  if (input.memo) builder.addMemo(Memo.text(input.memo.slice(0, 28)));

  const tx = builder.setTimeout(60).build();
  tx.sign(input.source);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/** Establish a trustline so the source can hold a non-native asset. */
export async function addTrustline(source: Keypair, assetCode: string): Promise<string> {
  if (isNative(assetCode)) {
    throw new Error("XLM is native — no trustline required.");
  }
  const account = await horizon.loadAccount(source.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: resolveAsset(assetCode) }))
    .setTimeout(60)
    .build();
  tx.sign(source);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/** Native (XLM) balance of an account. Returns 0 if the account is missing. */
export async function getNativeBalance(publicKey: string): Promise<number> {
  try {
    const account = await horizon.loadAccount(publicKey);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? Number(native.balance) : 0;
  } catch {
    return 0;
  }
}

/** Confirm a transaction exists and succeeded. */
export async function verifyTransaction(hash: string): Promise<{
  successful: boolean;
  ledger: number;
}> {
  const tx = await horizon.transactions().transaction(hash).call();
  return { successful: tx.successful, ledger: tx.ledger_attr };
}

/** Derive a muxed (M...) address for a base account + id. */
export function muxedAddress(basePublicKey: string, id: string | number): string {
  const muxed = new MuxedAccount(
    // MuxedAccount needs an Account-like; use a lightweight shim.
    { accountId: () => basePublicKey, sequenceNumber: () => "0", incrementSequenceNumber: () => {} },
    String(id)
  );
  return muxed.accountId();
}

/** Build a SEP-0007 payment request URI. */
export function buildInvoiceUri(params: {
  destination: string;
  amount?: string;
  assetCode?: string;
  memo?: string;
}): string {
  const q = new URLSearchParams();
  q.set("destination", params.destination);
  if (params.amount) q.set("amount", String(params.amount));
  if (params.assetCode && !isNative(params.assetCode)) {
    q.set("asset_code", params.assetCode);
    q.set("asset_issuer", resolveAsset(params.assetCode).getIssuer());
  }
  if (params.memo) q.set("memo", params.memo);
  return `web+stellar:pay?${q.toString()}`;
}

export interface WaitForPaymentInput {
  address: string;
  assetCode?: string;
  minAmount?: number;
  timeoutSec: number;
  onPoll?: (attempt: number) => void;
}

/**
 * Poll Horizon for an incoming payment to `address`. Resolves with the matching
 * payment record, or null on timeout.
 */
export async function waitForPayment(
  input: WaitForPaymentInput
): Promise<{ amount: string; from: string; txHash: string } | null> {
  const start = Date.now();
  const deadline = start + input.timeoutSec * 1000;
  const wantNative = isNative(input.assetCode);
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    input.onPoll?.(attempt);
    try {
      const page = await horizon
        .payments()
        .forAccount(input.address)
        .order("desc")
        .limit(20)
        .call();

      for (const record of page.records) {
        if (record.type !== "payment") continue;
        const r = record as unknown as {
          to: string;
          from: string;
          amount: string;
          asset_type: string;
          asset_code?: string;
          created_at: string;
          transaction_hash: string;
        };
        if (r.to !== input.address) continue;
        if (new Date(r.created_at).getTime() < start) continue;

        const recordNative = r.asset_type === "native";
        if (wantNative !== recordNative) continue;
        if (!wantNative && r.asset_code !== (input.assetCode ?? "").toUpperCase()) continue;
        if (input.minAmount && Number(r.amount) < input.minAmount) continue;

        return { amount: r.amount, from: r.from, txHash: r.transaction_hash };
      }
    } catch {
      // Account may not exist yet; keep polling until timeout.
    }
    await sleep(3000);
  }
  return null;
}

function normalizeAmount(amount: string | number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid amount: ${amount}`);
  // Stellar amounts allow up to 7 decimal places.
  return n.toFixed(7).replace(/\.?0+$/, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
