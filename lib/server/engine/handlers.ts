import { Keypair, Address, Operation, TransactionBuilder, BASE_FEE, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import crypto from "crypto";
import { getServerNetwork, type ServerNetwork } from "../stellar/network";
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

const getVal = (node: WorkflowNode, key: string, ctx: RunContext): any => {
  if (ctx.currentRow && ctx.currentRow[key] !== undefined) {
    return ctx.currentRow[key];
  }
  return node.data[key];
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
    const fund = canFund && getVal(node, "fund", ctx) !== false;
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
    const pk = str(getVal(node, "publicKey", ctx));
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
    const pk = str(getVal(node, "publicKey", ctx));
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
    const muxed = getVal(node, "muxed", ctx) === true;
    if (muxed) {
      const id = str(getVal(node, "memoId", ctx)) ?? "1";
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
    const code = str(getVal(node, "assetCode", ctx)) ?? "USDC";
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
    const destination = str(getVal(node, "destination", ctx));
    const amount = str(getVal(node, "amount", ctx));
    const asset = str(getVal(node, "asset", ctx)) ?? "XLM";
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
        memo: str(getVal(node, "memo", ctx)),
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
    const dest = ctx.currentAccount?.publicKey() ?? str(getVal(node, "destination", ctx));
    if (!dest) throw new Error("Create Invoice needs a wallet or destination.");
    const uri = buildInvoiceUri({
      destination: dest,
      amount: str(getVal(node, "amount", ctx)),
      assetCode: str(getVal(node, "asset", ctx)),
      memo: str(getVal(node, "reference", ctx)),
    });
    ctx.outputs[node.id] = { invoiceUri: uri };
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "success", message: `Invoice (SEP-7): ${uri}` });
  },

  "wait-for-payment": async (node, ctx) => {
    const address = str(getVal(node, "address", ctx)) ?? ctx.currentAccount?.publicKey();
    if (!address) throw new Error("Wait for Payment needs a watch address.");
    const timeout = num(getVal(node, "timeout", ctx)) ?? 120;
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "network",
      message: `Watching ${address} for up to ${timeout}s…`,
    });
    const result = await waitForPayment({
      net: ctx.net,
      address,
      assetCode: str(getVal(node, "asset", ctx)),
      minAmount: num(getVal(node, "amount", ctx)),
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
    const hash = str(getVal(node, "hash", ctx)) ?? (ctx.outputs._last?.txHash as string | undefined);
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
    const url = str(getVal(node, "url", ctx));
    if (!url) throw new Error("Trigger Webhook needs a URL.");
    const method = str(getVal(node, "method", ctx)) ?? "POST";
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
    const subject = str(getVal(node, "subject", ctx)) ?? "custom";

    // "Last transaction status" — a simple succeeded/failed check.
    if (subject === "lastStatus") {
      const want = str(getVal(node, "status", ctx)) ?? "succeeded";
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
      const custom = str(getVal(node, "customLeft", ctx)) ?? "";
      left = asNumberOrString(custom);
      label = "value";
    }

    const right = asNumberOrString(str(getVal(node, "value", ctx)) ?? "");
    const op = str(getVal(node, "op", ctx)) ?? "gte";
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
    const seconds = Math.min(num(getVal(node, "seconds", ctx)) ?? 3, 30);
    ctx.emit({ nodeId: node.id, blockType: node.type, level: "info", message: `Waiting ${seconds}s…` });
    await new Promise((r) => setTimeout(r, seconds * 1000));
  },

  "csv-import": async (node, ctx) => {
    const rows = (node.data.rows as any[]) || [];
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `CSV Import: Loaded CSV file containing ${rows.length} rows.`,
    });
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
  "deploy-contract": async (node, ctx) => {
    const source = requireAccount(ctx);
    const wasmObj = node.data.wasm as { filename?: string; base64?: string } | null | undefined;
    if (!wasmObj || !wasmObj.base64) {
      throw new Error("Deploy Contract: WASM file is required. Upload a contract (.wasm) in the inspector first.");
    }
    
    const wasmBuffer = Buffer.from(wasmObj.base64, "base64");
    const blockNetwork = str(node.data.network);
    const net = blockNetwork === "mainnet" || blockNetwork === "testnet" 
      ? getServerNetwork(blockNetwork) 
      : ctx.net;

    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "info",
      message: `Deploy Contract: Uploading WASM "${wasmObj.filename ?? "contract.wasm"}" (${(wasmBuffer.length / 1024).toFixed(1)} KB) on ${net.id}…`,
    });

    const wasmHashBuffer = crypto.createHash("sha256").update(wasmBuffer).digest();
    const uploadOp = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });
    
    await submitSorobanTx(net, source, uploadOp, node, ctx, "Upload WASM");

    let constructorArgs: any[] = [];
    const argsRaw = str(node.data.constructorArgs);
    if (argsRaw) {
      try {
        const parsed = JSON.parse(argsRaw);
        if (!Array.isArray(parsed)) {
          throw new Error("Constructor arguments must be a JSON array.");
        }
        constructorArgs = parsed.map((arg) => nativeToScVal(arg));
      } catch (err: any) {
        throw new Error(`Deploy Contract: invalid constructor arguments: ${err.message}`);
      }
    }

    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "info",
      message: "Deploy Contract: Instantiating contract instance…",
    });

    const salt = crypto.randomBytes(32);
    const createOp = Operation.createCustomContract({
      address: new Address(source.publicKey()),
      wasmHash: wasmHashBuffer,
      constructorArgs,
      salt,
    });

    const createTxResult = await submitSorobanTx(net, source, createOp, node, ctx, "Instantiate Contract");

    let contractId: string;
    try {
      const resultXdr = createTxResult.resultXdr;
      const txResult = xdr.TransactionResult.fromXDR(resultXdr, "base64");
      const opResult = txResult.result().results()[0];
      const invokeHostFunctionResult = opResult.tr().invokeHostFunctionResult();
      const scValBytes = invokeHostFunctionResult.success();
      const scVal = xdr.ScVal.fromXDR(scValBytes);
      contractId = Address.fromScVal(scVal).toString();
    } catch (err: any) {
      throw new Error(`Deploy Contract: failed to parse contract ID from transaction result: ${err.message}`);
    }

    ctx.outputs[node.id] = { contractId };
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "success",
      message: `Contract successfully deployed! ID: ${contractId}`,
    });
  },

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

      const depositExplorerUrl = ctx.net.explorerTx(res.hash);
      ctx.outputs[node.id] = {
        txHash: res.hash,
        poolId: res.poolId,
        explorerUrl: depositExplorerUrl,
        estimatedLpTokens: res.estimatedLpTokens,
        depositedA: amountA,
        depositedB: amountB,
        status: "succeeded",
      };
      ctx.outputs._last = { txHash: res.hash, poolId: res.poolId, explorerUrl: depositExplorerUrl, status: "succeeded" };

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Deposited into pool ${res.poolId.slice(0, 8)}… ~${res.estimatedLpTokens} LP tokens received — ${depositExplorerUrl}`,
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

      const withdrawExplorerUrl = ctx.net.explorerTx(res.hash);
      ctx.outputs[node.id] = {
        txHash: res.hash,
        poolId: res.poolId,
        explorerUrl: withdrawExplorerUrl,
        sharesBurned: res.sharesBurned,
        status: "succeeded",
      };
      ctx.outputs._last = { txHash: res.hash, poolId: res.poolId, explorerUrl: withdrawExplorerUrl, status: "succeeded" };

      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `Withdrew ${shares} LP shares from pool ${res.poolId.slice(0, 8)}… — ${withdrawExplorerUrl}`,
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
      message: str(getVal(node, "message", ctx)) ?? "Workflow completed successfully.",
    });
  },

  "on-error": async (node, ctx) => {
    ctx.emit({
      nodeId: node.id,
      blockType: node.type,
      level: "info",
      message: str(getVal(node, "message", ctx)) ?? "Error handler ready.",
    });
  },
};

async function submitSorobanTx(
  net: ServerNetwork,
  source: Keypair,
  op: any,
  node: WorkflowNode,
  ctx: RunContext,
  stageLabel: string
): Promise<any> {
  const account = await net.horizon.loadAccount(source.publicKey());
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: net.passphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await net.sorobanRpc.simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(sim)) {
    tx = rpc.assembleTransaction(tx, sim).build();
  } else {
    const err = (sim as any).error ? JSON.stringify((sim as any).error) : JSON.stringify(sim);
    throw new Error(`${stageLabel} simulation failed: ${err}`);
  }

  tx.sign(source);
  const response = await net.sorobanRpc.sendTransaction(tx);
  if (response.status === "ERROR") {
    throw new Error(`${stageLabel} submission failed: ${JSON.stringify((response as any).errorResult || (response as any).errorResultXdr || response)}`);
  }

  const txHash = response.hash;
  ctx.emit({
    nodeId: node.id,
    blockType: node.type,
    level: "network",
    message: `${stageLabel} submitted. Hash: ${txHash}. Waiting for ledger…`,
  });

  const deadline = Date.now() + 60 * 1000;
  while (Date.now() < deadline) {
    const status = await net.sorobanRpc.getTransaction(txHash);
    if (status.status === "SUCCESS") {
      ctx.emit({
        nodeId: node.id,
        blockType: node.type,
        level: "success",
        message: `${stageLabel} confirmed. Hash: ${txHash}`,
      });
      return status;
    }
    if (status.status === "FAILED") {
      throw new Error(`${stageLabel} failed: ${JSON.stringify(status.resultXdr || status)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${stageLabel} confirmation timed out.`);
}

/** Prove real Soroban RPC connectivity; full invoke needs args + signing. */
async function contractPing(node: WorkflowNode, ctx: RunContext, label: string) {
  const contractId = str(getVal(node, "contractId", ctx));
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
