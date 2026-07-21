import { Keypair } from "@stellar/stellar-sdk";
import {
  addTrustline,
  analyzeSwap,
  buildInvoiceUri,
  configureMultisigAccount,
  createFundedKeypair,
  depositLiquidityPool,
  getLiquidityPoolInfo,
  executeSwap,
  getNativeBalance,
  muxedAddress,
  sendPayment,
  verifyTransaction,
  waitForPayment,
  withdrawLiquidityPool,
} from "../stellar/operations";
import type { BlockHandler, RunContext } from "./types";
import type { WorkflowNode } from "../workflow-schema";

const str = (v: unknown): string | undefined =>
  v === undefined || v === null || v === "" ? undefined : String(v);
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Require an active signer, with a helpful error if the graph is missing one. */
function requireAccount(ctx: RunContext): Keypair {
  if (!ctx.currentAccount) {
    throw new Error(
      "No wallet in scope — add a Create Wallet or Connect Wallet block before this one."
    );
  }
  return ctx.currentAccount;
}

const HANDLERS: Record<string, BlockHandler> = {
  "trigger-manual": async (node, ctx) => {
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "info", message: "Workflow started." });
  },

  "create-wallet": async (node, ctx) => {
    // Friendbot exists on testnet only — on mainnet the account is created
    // unfunded and the user must fund it themselves.
    const canFund = !!ctx.net.friendbotUrl;
    const fund = canFund && node.data.fund !== false;
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "network", message: "Generating keypair…" });
    const kp = fund ? await createFundedKeypair(ctx.net) : Keypair.random();
    ctx.currentAccount = kp;
    ctx.outputs[node.id] = { publicKey: kp.publicKey() };
    await ctx.saveWallet(kp, "create-wallet");
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `Wallet created: ${kp.publicKey()}${fund ? " (funded via Friendbot)" : ""}`,
    });
    if (!fund && ctx.net.id === "mainnet") {
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "info",
        message: "Wallet is unfunded — fund it manually on mainnet before it can transact.",
      });
    }
  },

  "use-wallet": async (node, ctx) => {
    const pk = str(node.data.publicKey);
    if (!pk) throw new Error("Use Saved Wallet: choose a wallet from your vault.");
    const secret = ctx.signers?.[pk];
    if (!secret) {
      throw new Error(
        `Use Saved Wallet: no unlocked signer for ${pk}. Unlock your wallet vault before running.`
      );
    }
    ctx.currentAccount = Keypair.fromSecret(secret);
    ctx.outputs[node.id] = { publicKey: pk };
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Using saved wallet ${pk}` });
  },

  "connect-wallet": async (node, ctx) => {
    // 1. An external secret key typed into this block (ephemeral, per node).
    const secret = ctx.nodeSecrets?.[node.id];
    if (secret) {
      let kp: Keypair;
      try {
        kp = Keypair.fromSecret(secret);
      } catch {
        throw new Error("Connect Wallet: that private key is invalid (expected an S… secret key).");
      }
      ctx.currentAccount = kp;
      ctx.outputs[node.id] = { publicKey: kp.publicKey() };
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Connected external wallet ${kp.publicKey()}` });
      return;
    }
    // 2. An unlocked vault wallet selected on this block.
    const pk = str(node.data.publicKey);
    if (pk && ctx.signers?.[pk]) {
      ctx.currentAccount = Keypair.fromSecret(ctx.signers[pk]);
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Connected saved wallet ${pk}` });
      return;
    }
    if (ctx.currentAccount) {
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "info",
        message: `Using wallet ${ctx.currentAccount.publicKey()}`,
      });
      return;
    }
    // Sandbox: provision a custodial wallet so the run can sign. In production
    // this block connects Freighter in the browser instead.
    const kp = await createFundedKeypair(ctx.net);
    ctx.currentAccount = kp;
    ctx.outputs[node.id] = { publicKey: kp.publicKey() };
    await ctx.saveWallet(kp, "connect-wallet");
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `Sandbox provisioned wallet ${kp.publicKey()} (production connects Freighter).`,
    });
  },

  "generate-address": async (node, ctx) => {
    const account = requireAccount(ctx);
    const muxed = node.data.muxed === true;
    if (muxed) {
      const id = str(node.data.memoId) ?? "1";
      const address = muxedAddress(account.publicKey(), id);
      ctx.outputs[node.id] = { address };
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Muxed address: ${address}` });
    } else {
      ctx.outputs[node.id] = { address: account.publicKey() };
      ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Receiving address: ${account.publicKey()}` });
    }
  },

  "establish-trustline": async (node, ctx) => {
    const account = requireAccount(ctx);
    const code = str(node.data.assetCode) ?? "USDC";
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "network", message: `Adding ${code} trustline…` });
    const hash = await addTrustline(ctx.net, account, code);
    ctx.outputs[node.id] = { txHash: hash };
    ctx.outputs._last = { txHash: hash };
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Trustline set`, txHash: hash });
  },

  "multisig-wallet": async (node, ctx) => {
    const kp = requireAccount(ctx);
    const rawSigners = (node.data.signers as Array<{ publicKey?: string; weight?: number }>) || [];
    const signers = rawSigners
      .filter((s) => s.publicKey && String(s.publicKey).trim().length > 0)
      .map((s) => ({
        publicKey: String(s.publicKey).trim(),
        weight: num(s.weight) ?? 1,
      }));

    const lowThreshold = num(node.data.lowThreshold) ?? 1;
    const mediumThreshold = num(node.data.mediumThreshold) ?? 2;
    const highThreshold = num(node.data.highThreshold) ?? 3;

    if (
      lowThreshold < 0 ||
      lowThreshold > 255 ||
      mediumThreshold < 0 ||
      mediumThreshold > 255 ||
      highThreshold < 0 ||
      highThreshold > 255
    ) {
      throw new Error("Multisig Wallet: Thresholds must be between 0 and 255.");
    }

    if (lowThreshold > mediumThreshold || mediumThreshold > highThreshold) {
      throw new Error("Multisig Wallet: Thresholds must satisfy low <= medium <= high.");
    }

    const totalWeight = signers.reduce((acc, s) => acc + s.weight, 1);
    if (totalWeight < highThreshold) {
      throw new Error(
        `Multisig Wallet: Total signer weight (${totalWeight}) is less than high threshold (${highThreshold}).`
      );
    }

    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `Configuring ${signers.length} signer(s) & thresholds (low: ${lowThreshold}, med: ${mediumThreshold}, high: ${highThreshold})…`,
    });

    const result = await configureMultisigAccount(ctx.net, kp, {
      signers,
      lowThreshold,
      mediumThreshold,
      highThreshold,
    });

    ctx.outputs[node.id] = {
      txHash: result.hash,
      signers: result.signers,
      thresholds: result.thresholds,
    };
    ctx.outputs._last = { txHash: result.hash };

    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `Multisig configured on ${kp.publicKey().slice(0, 6)}…${kp.publicKey().slice(-4)}`,
      txHash: result.hash,
    });
  },

  "send-payment": async (node, ctx) => {
    const source = requireAccount(ctx);
    const destination = str(node.data.destination);
    const amount = str(node.data.amount);
    const asset = str(node.data.asset) ?? "XLM";
    if (!destination) throw new Error("Send Payment: destination is required.");
    if (!amount) throw new Error("Send Payment: amount is required.");
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `Sending ${amount} ${asset} → ${destination}…`,
    });
    try {
      const hash = await sendPayment(ctx.net, {
        source,
        destination,
        assetCode: asset,
        amount,
        memo: str(node.data.memo),
      });
      ctx.outputs[node.id] = { txHash: hash, amount };
      ctx.outputs._last = { txHash: hash, amount, status: "succeeded" };
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Payment confirmed — ${ctx.net.explorerTx(hash)}`,
        txHash: hash,
      });
    } catch (e) {
      throw new Error(explainHorizonError(e, asset));
    }
  },

  "receive-payment": async (node, ctx) => {
    const account = requireAccount(ctx);
    ctx.outputs[node.id] = { address: account.publicKey() };
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "info",
      message: `Ready to receive at ${account.publicKey()} — share this address or the invoice.`,
    });
  },

  "create-invoice": async (node, ctx) => {
    const dest = ctx.currentAccount?.publicKey() ?? str(node.data.destination);
    if (!dest) throw new Error("Create Invoice needs a wallet or destination.");
    const uri = buildInvoiceUri({
      destination: dest,
      amount: str(node.data.amount),
      assetCode: str(node.data.asset),
      memo: str(node.data.reference),
    });
    ctx.outputs[node.id] = { invoiceUri: uri };
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Invoice (SEP-7): ${uri}` });
  },

  "wait-for-payment": async (node, ctx) => {
    const address = str(node.data.address) ?? ctx.currentAccount?.publicKey();
    if (!address) throw new Error("Wait for Payment needs a watch address.");
    const timeout = num(node.data.timeout) ?? 120;
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `Watching ${address} for up to ${timeout}s…`,
    });
    const result = await waitForPayment({
      net: ctx.net,
      address,
      assetCode: str(node.data.asset),
      minAmount: num(node.data.amount),
      timeoutSec: timeout,
      onPoll: (a) => {
        if (a % 4 === 0)
          ctx.emit({ nodeId: node.id, blockType: node.type, level: "info", message: `  …still waiting (${a})` });
      },
    });
    if (!result) throw new Error(`No matching payment within ${timeout}s.`);
    ctx.outputs[node.id] = { amount: result.amount, from: result.from, txHash: result.txHash };
    ctx.outputs._last = { txHash: result.txHash, amount: result.amount, status: "succeeded" };
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `Received ${result.amount} from ${result.from}`,
      txHash: result.txHash,
    });
  },

  "verify-transaction": async (node, ctx) => {
    const hash = str(node.data.hash) ?? (ctx.outputs._last?.txHash as string | undefined);
    if (!hash) throw new Error("Verify Transaction needs a tx hash (or a prior tx to verify).");
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "network", message: `Verifying ${hash}…` });
    const res = await verifyTransaction(ctx.net, hash);
    ctx.outputs[node.id] = { successful: res.successful, ledger: res.ledger };
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: res.successful ? "success" : "error",
      message: res.successful ? `Verified in ledger ${res.ledger}` : "Transaction failed on-chain.",
    });
  },

  "trigger-webhook": async (node, ctx) => {
    const url = str(node.data.url);
    if (!url) throw new Error("Trigger Webhook needs a URL.");
    const method = str(node.data.method) ?? "POST";
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "network", message: `${method} ${url}` });
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "soroban-studio", outputs: ctx.outputs }),
    });
    ctx.outputs[node.id] = { status: res.status };
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: res.ok ? "success" : "warn",
      message: `Webhook responded ${res.status}`,
    });
  },

  condition: async (node, ctx) => {
    const subject = str(node.data.subject) ?? "custom";

    // "Last transaction status" — a simple succeeded/failed check.
    if (subject === "lastStatus") {
      const want = str(node.data.status) ?? "succeeded";
      const actual = str(ctx.outputs._last?.status) ?? "unknown";
      const result = actual === want;
      ctx.outputs[node.id] = { result };
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: result ? "success" : "warn",
        message: `Condition: last transaction ${actual}, expected ${want} → ${result ? "pass" : "fail"}`,
      });
      return;
    }

    // Numeric/text comparison against a value.
    let left: number | string;
    let label: string;
    if (subject === "balance") {
      const account = requireAccount(ctx);
      left = await getNativeBalance(ctx.net, account.publicKey());
      label = "wallet balance";
    } else if (subject === "lastAmount") {
      left = Number(ctx.outputs._last?.amount ?? NaN);
      label = "last payment amount";
    } else {
      const custom = str(node.data.customLeft) ?? "";
      left = asNumberOrString(custom);
      label = "value";
    }

    const right = asNumberOrString(str(node.data.value) ?? "");
    const op = str(node.data.op) ?? "gte";
    const result = compareValues(left, right, op);

    ctx.outputs[node.id] = { result, left };
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: result ? "success" : "warn",
      message: `Condition: ${label} (${left}) ${OP_LABEL[op] ?? op} ${right} → ${result ? "pass" : "fail"}`,
    });
  },

  delay: async (node, ctx) => {
    const seconds = Math.min(num(node.data.seconds) ?? 3, 30);
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "info", message: `Waiting ${seconds}s…` });
    await new Promise((r) => setTimeout(r, seconds * 1000));
  },

  "confidential-transfer": async (node, ctx) => {
    // Honest limitation: requires a deployed confidential-token Soroban contract.
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "warn",
      message:
        "Confidential Transfer is simulated — provide a deployed confidential-token contract to run for real.",
    });
    ctx.outputs[node.id] = { simulated: true };
  },

  "invoke-contract": async (node, ctx) => contractPing(node, ctx, "Invoke Contract"),
  "deploy-contract": async (node, ctx) => contractPing(node, ctx, "Deploy Contract"),

  "swap-asset": async (node, ctx) => {
    const account = requireAccount(ctx);

    const sendAsset = str(node.data.sendAsset) ?? "XLM";
    const destAsset = str(node.data.destAsset) ?? "USDC";
    const amount = num(node.data.amount);
    const mode = str(node.data.mode) ?? "exact-in";
    const slippageBps = num(node.data.slippageBps) ?? 100;
    const sharpness = str(node.data.sharpness) ?? "fast";

    if (sendAsset.toUpperCase() === destAsset.toUpperCase()) {
      throw new Error("Swap Asset: input asset and output asset must be different.");
    }
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Swap Asset: amount must be greater than zero.");
    }

    // Step 1 — fetch a live quote so we can log the preview before executing.
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `Fetching ${sendAsset} → ${destAsset} liquidity quote (${mode})…`,
    });

    let quote;
    try {
      quote = await analyzeSwap({
        net: ctx.net,
        source: account,
        sendAsset,
        destAsset,
        amount: String(amount),
        mode: mode as "exact-in" | "exact-out",
        slippageBps,
        sharpness,
      });
    } catch (e) {
      throw new Error(`Swap Asset (quote): ${(e as Error).message}`);
    }

    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "info",
      message:
        `Quote: ~${quote.expectedReceive} ${destAsset} received` +
        ` (route: ${quote.route}, min after ${slippageBps / 100}% slippage: ${quote.sendAmountMin} ${sendAsset}).`,
    });

    // Step 2 — execute the real path-payment transaction.
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `Submitting ${mode === "exact-out" ? "pathPaymentStrictReceive" : "pathPaymentStrictSend"} transaction…`,
    });

    try {
      const result = await executeSwap({
        net: ctx.net,
        source: account,
        sendAsset,
        destAsset,
        amount: String(amount),
        mode: mode as "exact-in" | "exact-out",
        slippageBps,
        sharpness,
        quote,
      });

      ctx.outputs[node.id] = {
        txHash: result.txHash,
        sendAsset,
        destAsset,
        sentAmount: result.sentAmount,
        receivedAmount: result.receivedAmount,
        mode,
        slippageBps,
        route: quote.route,
      };
      ctx.outputs._last = {
        txHash: result.txHash,
        amount: result.receivedAmount,
        status: "succeeded",
      };

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message:
          `Swap confirmed — sent ${result.sentAmount} ${sendAsset},` +
          ` received ${result.receivedAmount} ${destAsset}.` +
          ` ${ctx.net.explorerTx(result.txHash)}`,
        txHash: result.txHash,
      });
    } catch (e) {
      throw new Error(explainSwapError(e, sendAsset, destAsset));
    }
  },

  "liquidity-pool": async (node, ctx) => {
    const source = requireAccount(ctx);
    const action = str(node.data.action) ?? "deposit";
    const assetA = str(node.data.assetA) ?? "XLM";
    const assetB = str(node.data.assetB) ?? "USDC";
    const poolId = str(node.data.poolId);

    if (action === "deposit") {
      const amountA = str(node.data.amountA);
      const amountB = str(node.data.amountB);
      if (!amountA || !amountB) {
        throw new Error("Liquidity Pool deposit requires both Asset A and Asset B amounts.");
      }

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "network",
        message: `Validating balances & depositing ${amountA} ${assetA} + ${amountB} ${assetB} into pool…`,
      });

      const res = await depositLiquidityPool(ctx.net, {
        source,
        assetCodeA: assetA,
        assetCodeB: assetB,
        amountA,
        amountB,
        minPrice: str(node.data.minPrice) ?? "0.1",
        maxPrice: str(node.data.maxPrice) ?? "10",
        poolId,
      });

      ctx.outputs[node.id] = {
        txHash: res.hash,
        poolId: res.poolId,
        estimatedLpTokens: res.estimatedLpTokens,
        depositedA: amountA,
        depositedB: amountB,
        status: "succeeded",
      };
      ctx.outputs._last = { txHash: res.hash, status: "succeeded" };

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Deposited into pool ${res.poolId.slice(0, 8)}… ~${res.estimatedLpTokens} LP tokens received`,
        txHash: res.hash,
      });
    } else if (action === "withdraw") {
      const shares = str(node.data.shares);
      if (!shares) {
        throw new Error("Liquidity Pool withdraw requires LP shares amount.");
      }

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "network",
        message: `Withdrawing ${shares} LP shares from ${assetA}/${assetB} pool…`,
      });

      const res = await withdrawLiquidityPool(ctx.net, {
        source,
        assetCodeA: assetA,
        assetCodeB: assetB,
        shares,
        minAmountA: str(node.data.minAmountA),
        minAmountB: str(node.data.minAmountB),
        poolId,
      });

      ctx.outputs[node.id] = {
        txHash: res.hash,
        poolId: res.poolId,
        sharesBurned: res.sharesBurned,
        status: "succeeded",
      };
      ctx.outputs._last = { txHash: res.hash, status: "succeeded" };

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Withdrew ${shares} LP shares from pool ${res.poolId.slice(0, 8)}…`,
        txHash: res.hash,
      });
    } else {
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "network",
        message: `Fetching pool info for ${assetA}/${assetB}…`,
      });

      const info = await getLiquidityPoolInfo(ctx.net, assetA, assetB, poolId);

      ctx.outputs[node.id] = {
        poolId: info.poolId,
        totalShares: info.totalShares,
        reserves: info.reserves,
      };

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Pool ${info.poolId.slice(0, 8)}… total shares: ${info.totalShares}`,
      });
    }
  },

  "on-success": async (node, ctx) => {
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: str(node.data.message) ?? "Workflow completed successfully.",
    });
  },

  "on-error": async (node, ctx) => {
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "info",
      message: str(node.data.message) ?? "Error handler ready.",
    });
  },
};

/** Prove real Soroban RPC connectivity; full invoke needs args + signing. */
async function contractPing(node: WorkflowNode, ctx: RunContext, label: string) {
  const contractId = str(node.data.contractId);
  try {
    const latest = await ctx.net.sorobanRpc.getLatestLedger();
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `${label}: connected to Soroban RPC (ledger ${latest.sequence}).`,
    });
  } catch {
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "warn", message: `${label}: Soroban RPC unreachable.` });
  }
  ctx.emit({
    nodeId: node.id,
    blockType: node.type,
    level: "warn",
    message: contractId
      ? `${label} for ${contractId} is simulated — encoded args + signing land next.`
      : `${label} is simulated — set a contract id to target a real contract.`,
  });
  ctx.outputs[node.id] = { simulated: true, contractId };
}

function explainHorizonError(e: unknown, asset: string): string {
  const codes = extractResultCodes(e);
  if (codes.includes("op_no_trust"))
    return `Payment failed: the destination has no ${asset} trustline. Add a trustline on the receiving account first.`;
  if (codes.includes("op_underfunded")) return "Payment failed: source account is underfunded.";
  if (codes.includes("tx_bad_seq")) return "Payment failed: bad sequence — retry the run.";
  return `Payment failed${codes.length ? `: ${codes.join(", ")}` : `: ${(e as Error).message}`}`;
}

function explainSwapError(e: unknown, sendAsset: string, destAsset: string): string {
  // Surface the original message from executeSwap first (already human-readable).
  const msg = (e as Error).message ?? "";
  if (msg.startsWith("Swap Asset:")) return msg;

  const codes = extractResultCodes(e);
  if (codes.includes("op_too_few_offers"))
    return `Swap Asset: no liquidity path found for ${sendAsset} → ${destAsset}. Try a smaller amount or wider slippage.`;
  if (codes.includes("op_cross_self"))
    return `Swap Asset: the order would cross your own offers. Use a different account.`;
  if (codes.includes("op_underfunded"))
    return `Swap Asset: insufficient ${sendAsset} balance to complete the swap.`;
  if (codes.includes("op_no_trust"))
    return `Swap Asset: missing trustline for ${destAsset}. The auto-establish step failed — try adding the trustline manually first.`;
  if (codes.includes("tx_bad_seq"))
    return "Swap Asset: bad sequence number — retry the run.";
  return `Swap Asset failed${codes.length ? `: ${codes.join(", ")}` : `: ${msg}`}`;
}

function extractResultCodes(e: unknown): string[] {
  const data = (e as { response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } } })?.response?.data;
  const rc = data?.extras?.result_codes;
  return [...(rc?.operations ?? []), ...(rc?.transaction ? [rc.transaction] : [])];
}

const OP_LABEL: Record<string, string> = {
  gt: "is greater than",
  gte: "is greater than or equal to",
  lt: "is less than",
  lte: "is less than or equal to",
  eq: "is equal to",
  neq: "is not equal to",
};

function asNumberOrString(v: string): number | string {
  if (v.trim() === "") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function compareValues(left: number | string, right: number | string, op: string): boolean {
  const numeric = typeof left === "number" && typeof right === "number";
  switch (op) {
    case "gt": return numeric && left > right;
    case "gte": return numeric && left >= right;
    case "lt": return numeric && left < right;
    case "lte": return numeric && left <= right;
    case "neq": return String(left) !== String(right);
    default: return String(left) === String(right); // eq
  }
}

export function getHandler(type: string): BlockHandler | undefined {
  return HANDLERS[type];
}
