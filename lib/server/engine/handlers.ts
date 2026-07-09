import { Keypair } from "@stellar/stellar-sdk";
import { NETWORK, sorobanRpc } from "../stellar/network";
import {
  addTrustline,
  buildInvoiceUri,
  createFundedKeypair,
  fundWithFriendbot,
  getNativeBalance,
  muxedAddress,
  sendPayment,
  verifyTransaction,
  waitForPayment,
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
    const fund = node.data.fund !== false;
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "network", message: "Generating keypair…" });
    const kp = fund ? await createFundedKeypair() : Keypair.random();
    ctx.currentAccount = kp;
    ctx.outputs[node.id] = { publicKey: kp.publicKey() };
    await ctx.saveWallet(kp, "create-wallet");
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `Wallet created: ${kp.publicKey()}${fund ? " (funded via Friendbot)" : ""}`,
    });
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
    const kp = await createFundedKeypair();
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
    const hash = await addTrustline(account, code);
    ctx.outputs[node.id] = { txHash: hash };
    ctx.outputs._last = { txHash: hash };
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Trustline set`, txHash: hash });
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
      const hash = await sendPayment({
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
        message: `Payment confirmed — ${NETWORK.explorerTx(hash)}`,
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
    const res = await verifyTransaction(hash);
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
      left = await getNativeBalance(account.publicKey());
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
    // Path payments need on-chain liquidity/paths; kept advisory to avoid
    // failing runs on empty testnet order books.
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "warn",
      message: "Swap is advisory in the sandbox — wire a specific path/pool to execute for real.",
    });
    ctx.outputs[node.id] = { simulated: true };
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
    const latest = await sorobanRpc.getLatestLedger();
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
