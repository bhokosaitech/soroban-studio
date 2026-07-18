import {
  Account,
  BASE_FEE,
  Keypair,
  Memo,
  MuxedAccount,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { ServerNetwork } from "./network";
import { isNative, resolveAsset } from "./assets";

/** Fund an account with test XLM via Friendbot. Idempotent-ish on testnet. */
export async function fundWithFriendbot(net: ServerNetwork, publicKey: string): Promise<void> {
  if (!net.friendbotUrl) {
    throw new Error(`Friendbot is unavailable on ${net.id} — fund this account manually.`);
  }
  const res = await fetch(`${net.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    const body = await res.text();
    // Already-funded accounts return 400 — treat as non-fatal.
    if (!body.includes("op_already_exists") && res.status !== 400) {
      throw new Error(`Friendbot failed (${res.status})`);
    }
  }
}

/** Generate a new keypair and fund it on testnet. */
export async function createFundedKeypair(net: ServerNetwork): Promise<Keypair> {
  const kp = Keypair.random();
  await fundWithFriendbot(net, kp.publicKey());
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
export async function sendPayment(net: ServerNetwork, input: PaymentInput): Promise<string> {
  const account = await net.horizon.loadAccount(input.source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: net.passphrase,
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
  const res = await net.horizon.submitTransaction(tx);
  return res.hash;
}

/** Establish a trustline so the source can hold a non-native asset. */
export async function addTrustline(net: ServerNetwork, source: Keypair, assetCode: string): Promise<string> {
  if (isNative(assetCode)) {
    throw new Error("XLM is native — no trustline required.");
  }
  const account = await net.horizon.loadAccount(source.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: net.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: resolveAsset(assetCode) }))
    .setTimeout(60)
    .build();
  tx.sign(source);
  const res = await net.horizon.submitTransaction(tx);
  return res.hash;
}

/** Native (XLM) balance of an account. Returns 0 if the account is missing. */
export async function getNativeBalance(net: ServerNetwork, publicKey: string): Promise<number> {
  try {
    const account = await net.horizon.loadAccount(publicKey);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? Number(native.balance) : 0;
  } catch {
    return 0;
  }
}

/** Confirm a transaction exists and succeeded. */
export async function verifyTransaction(net: ServerNetwork, hash: string): Promise<{
  successful: boolean;
  ledger: number;
}> {
  const tx = await net.horizon.transactions().transaction(hash).call();
  return { successful: tx.successful, ledger: tx.ledger_attr };
}

/** Derive a muxed (M...) address for a base account + id. */
export function muxedAddress(basePublicKey: string, id: string | number): string {
  // MuxedAccount wraps a base Account; the sequence is irrelevant for address derivation.
  const muxed = new MuxedAccount(new Account(basePublicKey, "0"), String(id));
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
    q.set("asset_issuer", resolveAsset(params.assetCode).getIssuer() ?? "");
  }
  if (params.memo) q.set("memo", params.memo);
  return `web+stellar:pay?${q.toString()}`;
}

export interface WaitForPaymentInput {
  net: ServerNetwork;
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
      const page = await input.net.horizon
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

export interface SwapQuote {
  sendAmountMin: string;
  expectedReceive: string;
  route: string;
  slippageBps: number;
  number?: number;
  exactOut?: boolean;
  sharpness?: string;
}

export interface SwapAnalyzeInput {
  net: ServerNetwork;
  source: Keypair;
  sendAsset?: string;
  destAsset?: string;
  amount: string;
  mode?: "exact-in" | "exact-out";
  slippageBps?: number;
  sharpness?: string;
}

export async function analyzeSwap({
  net,
  source,
  sendAsset = "XLM",
  destAsset = "USDC",
  amount,
  mode = "exact-in",
  slippageBps = 100,
  sharpness = "fast",
}: SwapAnalyzeInput): Promise<SwapQuote> {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid swap amount.");
  }

  const maybePathAmount = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  let pathRecords: Record<string, unknown>[] = [];
  try {
    const sendIssuer = isNative(sendAsset) ? undefined : resolveAsset(sendAsset).getIssuer();
    const destIssuer = isNative(destAsset) ? undefined : resolveAsset(destAsset).getIssuer();
    const resp = await net.horizon
      .paths({
        sourceAssets: sendIssuer ? [`${sendAsset}:${sendIssuer}`] : ["native"],
        destinationAssetType: destIssuer ? "credit_alphanum4" : "native",
        destinationAssetCode: destIssuer ? undefined : "XLM",
        destinationAssetIssuer: destIssuer || undefined,
        sourceAccount: source.publicKey(),
        sourceAmount: mode === "exact-in" ? String(numericAmount) : undefined,
        destinationAmount: mode === "exact-out" ? String(numericAmount) : undefined,
      })
      .call();
    pathRecords = Array.isArray(resp.records) ? resp.records : [];
  } catch {
    // best-effort: fall back to advisory mode below.
  }

  const best = pathRecords[0];

  const expectedReceiveCandidates = [
    best?.destination_amount,
    best?.destinationAmount,
  ].map(maybePathAmount);
  const fallbackReceive = mode === "exact-in" ? numericAmount * 0.95 : numericAmount * 0.9;
  const expectedReceive =
    expectedReceiveCandidates.find(Boolean) ??
    (Number.isFinite(fallbackReceive) ? fallbackReceive : 0);
  if (!Number.isFinite(expectedReceive) || expectedReceive <= 0) {
    throw new Error("Cannot find a viable liquidity path for this swap.");
  }

  const sendAmountMinBase = mode === "exact-in" ? numericAmount : undefined;
  const sendAmountMinCandidates = [best?.source_amount, best?.sourceAmount].map(maybePathAmount);
  const sendAmountMinRaw =
    (mode === "exact-out"
      ? sendAmountMinCandidates.find(Boolean)
      : sendAmountMinBase) ??
    numericAmount;

  const sendAmountMin = (Number(sendAmountMinRaw) * (1 - slippageBps / 10000))
    .toFixed(7)
    .replace(/\.?0+$/, "");

  const pathLabels: string[] = [];
  const assetArr = Array.isArray(best?.path) ? best.path : [];
  for (const p of assetArr) {
    if (p?.asset_type === "native") pathLabels.push("XLM");
    else if (p?.asset_code && p?.asset_issuer) pathLabels.push(`${String(p.asset_code)}:${String(p.asset_issuer)}`);
  }

  return {
    sendAmountMin,
    expectedReceive: Number(expectedReceive).toFixed(7).replace(/\.?0+$/, ""),
    route: pathLabels.length ? pathLabels.join(" → ") : "Direct",
    slippageBps,
    number: numericAmount,
    exactOut: mode === "exact-out",
    sharpness,
  };
}

export interface SwapExecuteInput extends SwapAnalyzeInput {
  quote: SwapQuote;
}

/**
 * Execute a real Stellar DEX / AMM path-payment swap.
 *
 * Steps:
 *  1. Pre-validate: verify the source account has sufficient balance.
 *  2. Auto-establish a trustline for the destination asset if missing.
 *  3. Fetch the best liquidity path from Horizon (strictSendPaths /
 *     strictReceivePaths, falling back to the older paths() endpoint).
 *  4. Build + sign a pathPaymentStrictSend (exact-in) or
 *     pathPaymentStrictReceive (exact-out) transaction.
 *  5. Submit to the network and return txHash + actual amounts.
 */
export async function executeSwap({
  net,
  source,
  sendAsset = "XLM",
  destAsset = "USDC",
  amount,
  mode = "exact-in",
  slippageBps = 100,
}: SwapExecuteInput): Promise<{ txHash: string; receivedAmount: string; sentAmount: string }> {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Swap Asset: invalid amount.");
  }
  if (sendAsset.toUpperCase() === destAsset.toUpperCase()) {
    throw new Error("Swap Asset: send asset and destination asset must be different.");
  }

  const slippageFraction = slippageBps / 10000;
  const sendStellarAsset = resolveAsset(sendAsset);
  const destStellarAsset = resolveAsset(destAsset);

  // 1. Pre-validate balance.
  const accountData = await net.horizon.loadAccount(source.publicKey());
  if (isNative(sendAsset)) {
    const nativeBal = accountData.balances.find((b) => b.asset_type === "native");
    // Keep 1 XLM as minimum reserve.
    const available = nativeBal ? Number(nativeBal.balance) - 1 : 0;
    if (available < numericAmount) {
      throw new Error(
        `Swap Asset: insufficient XLM balance. Available ~${available.toFixed(2)} XLM, need ${numericAmount}.`
      );
    }
  } else {
    const assetBal = accountData.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        (b as { asset_code?: string }).asset_code === sendAsset.toUpperCase()
    );
    const available = assetBal ? Number(assetBal.balance) : 0;
    if (available < numericAmount) {
      throw new Error(
        `Swap Asset: insufficient ${sendAsset} balance. Available ${available.toFixed(2)}, need ${numericAmount}.`
      );
    }
  }

  // 2. Auto-establish trustline for the destination asset if it is non-native.
  if (!isNative(destAsset)) {
    const hasTrustline = accountData.balances.some(
      (b) =>
        b.asset_type !== "native" &&
        (b as { asset_code?: string }).asset_code === destAsset.toUpperCase()
    );
    if (!hasTrustline) {
      const tlAccount = await net.horizon.loadAccount(source.publicKey());
      const tlTx = new TransactionBuilder(tlAccount, {
        fee: BASE_FEE,
        networkPassphrase: net.passphrase,
      })
        .addOperation(Operation.changeTrust({ asset: destStellarAsset }))
        .setTimeout(60)
        .build();
      tlTx.sign(source);
      await net.horizon.submitTransaction(tlTx);
    }
  }

  // 3. Fetch the best liquidity path.
  type PathRecord = {
    source_amount?: string;
    destination_amount?: string;
    path?: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
  };
  let pathRecords: PathRecord[] = [];

  // Try the modern strict-send / strict-receive path endpoints first.
  const horizonAny = net.horizon as unknown as Record<string, unknown>;
  try {
    if (mode === "exact-in" && typeof horizonAny.strictSendPaths === "function") {
      const resp = await (
        horizonAny.strictSendPaths as (
          s: unknown,
          a: string,
          d: unknown[]
        ) => { call: () => Promise<{ records: PathRecord[] }> }
      )(sendStellarAsset, String(numericAmount), [destStellarAsset]).call();
      pathRecords = resp.records ?? [];
    } else if (mode === "exact-out" && typeof horizonAny.strictReceivePaths === "function") {
      const resp = await (
        horizonAny.strictReceivePaths as (
          s: unknown[],
          d: unknown,
          a: string
        ) => { call: () => Promise<{ records: PathRecord[] }> }
      )([sendStellarAsset], destStellarAsset, String(numericAmount)).call();
      pathRecords = resp.records ?? [];
    }
  } catch {
    // Fall through to legacy endpoint below.
  }

  // Fall back to the legacy paths() endpoint if needed.
  if (pathRecords.length === 0) {
    try {
      const sendIssuer = isNative(sendAsset) ? undefined : resolveAsset(sendAsset).getIssuer();
      const destIssuer = isNative(destAsset) ? undefined : resolveAsset(destAsset).getIssuer();
      const resp = await net.horizon
        .paths({
          sourceAssets: sendIssuer ? [`${sendAsset}:${sendIssuer}`] : ["native"],
          destinationAssetType: destIssuer ? "credit_alphanum4" : "native",
          destinationAssetCode: destIssuer ? undefined : "XLM",
          destinationAssetIssuer: destIssuer || undefined,
          sourceAccount: source.publicKey(),
          sourceAmount: mode === "exact-in" ? String(numericAmount) : undefined,
          destinationAmount: mode === "exact-out" ? String(numericAmount) : undefined,
        })
        .call();
      pathRecords = Array.isArray(resp.records) ? (resp.records as PathRecord[]) : [];
    } catch {
      // Will throw the "no path" error below.
    }
  }

  const best = pathRecords[0];
  if (!best) {
    throw new Error(
      `Swap Asset: no liquidity path found for ${sendAsset} → ${destAsset}. ` +
        `Ensure both assets are active on ${net.id} and an order book / AMM pool exists.`
    );
  }

  // Resolve intermediate hop assets.
  const { Asset: StellarAsset } = await import("@stellar/stellar-sdk");
  const resolveHop = (p: { asset_type: string; asset_code?: string; asset_issuer?: string }) => {
    if (p.asset_type === "native") return StellarAsset.native();
    return new StellarAsset(p.asset_code!, p.asset_issuer!);
  };
  const intermediatePath = (Array.isArray(best.path) ? best.path : []).map(resolveHop);

  // 4. Build + sign the transaction.
  const freshAccount = await net.horizon.loadAccount(source.publicKey());
  const txBuilder = new TransactionBuilder(freshAccount, {
    fee: BASE_FEE,
    networkPassphrase: net.passphrase,
  });

  let sentAmount: string;
  let receivedAmount: string;

  if (mode === "exact-in") {
    // pathPaymentStrictSend: spend exactly `numericAmount`, receive at least `destMin`.
    const expectedReceive =
      Number(best.destination_amount ?? 0) > 0
        ? Number(best.destination_amount)
        : numericAmount * 0.95;
    const destMin = (expectedReceive * (1 - slippageFraction)).toFixed(7).replace(/\.?0+$/, "");

    txBuilder.addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: sendStellarAsset,
        sendAmount: normalizeAmount(numericAmount),
        destination: source.publicKey(), // swap-to-self; caller can override downstream
        destAsset: destStellarAsset,
        destMin,
        path: intermediatePath,
      })
    );
    sentAmount = normalizeAmount(numericAmount);
    receivedAmount = expectedReceive.toFixed(7).replace(/\.?0+$/, "");
  } else {
    // pathPaymentStrictReceive: receive exactly `numericAmount`, spend at most `sendMax`.
    const expectedSend =
      Number(best.source_amount ?? 0) > 0 ? Number(best.source_amount) : numericAmount * 1.05;
    const sendMax = (expectedSend * (1 + slippageFraction)).toFixed(7).replace(/\.?0+$/, "");

    txBuilder.addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: sendStellarAsset,
        sendMax,
        destination: source.publicKey(),
        destAsset: destStellarAsset,
        destAmount: normalizeAmount(numericAmount),
        path: intermediatePath,
      })
    );
    sentAmount = expectedSend.toFixed(7).replace(/\.?0+$/, "");
    receivedAmount = normalizeAmount(numericAmount);
  }

  const tx = txBuilder.setTimeout(60).build();
  tx.sign(source);

  // 5. Submit and return.
  const result = await net.horizon.submitTransaction(tx);
  return {
    txHash: result.hash,
    receivedAmount,
    sentAmount,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


export interface MultisigInput {
  signers?: Array<{ publicKey: string; weight: number }>;
  lowThreshold?: number;
  mediumThreshold?: number;
  highThreshold?: number;
}

/** Configure signers and operational thresholds for a Stellar account. */
export async function configureMultisigAccount(
  net: ServerNetwork,
  source: Keypair,
  input: MultisigInput
): Promise<{
  hash: string;
  signers: Array<{ key: string; weight: number }>;
  thresholds: { low: number; med: number; high: number };
}> {
  const account = await net.horizon.loadAccount(source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: net.passphrase,
  });

  if (input.signers && input.signers.length > 0) {
    for (const s of input.signers) {
      if (!s.publicKey) continue;
      builder.addOperation(
        Operation.setOptions({
          signer: {
            ed25519PublicKey: s.publicKey,
            weight: Number(s.weight) || 0,
          },
        })
      );
    }
  }

  builder.addOperation(
    Operation.setOptions({
      lowThreshold: input.lowThreshold ?? 1,
      medThreshold: input.mediumThreshold ?? 2,
      highThreshold: input.highThreshold ?? 3,
    })
  );

  const tx = builder.setTimeout(60).build();
  tx.sign(source);
  const res = await net.horizon.submitTransaction(tx);

  const updatedAccount = await net.horizon.loadAccount(source.publicKey());
  return {
    hash: res.hash,
    signers: updatedAccount.signers.map((s) => ({ key: s.key, weight: s.weight })),
    thresholds: {
      low: updatedAccount.thresholds.low_threshold,
      med: updatedAccount.thresholds.med_threshold,
      high: updatedAccount.thresholds.high_threshold,
    },
  };
}
