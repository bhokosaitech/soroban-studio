import type { Keypair } from "@stellar/stellar-sdk";
import type { WorkflowNode } from "../workflow-schema";
import type { ServerNetwork } from "../stellar/network";

export type LogLevel = "info" | "success" | "error" | "network" | "warn";

export interface RunLogEvent {
  nodeId: string;
  blockType: string;
  level: LogLevel;
  message: string;
  txHash?: string;
  at: number;
}

/**
 * Shared, mutable context threaded through a run. Handlers read/write it to
 * pass values between blocks (e.g. the wallet a payment should be signed with).
 */
export interface RunContext {
  /** The Stellar network this run executes against (resolved from meta.network). */
  net: ServerNetwork;
  /** The active signer — set by create-wallet / connect-wallet / use-wallet. */
  currentAccount?: Keypair;
  /**
   * Ephemeral signers for saved (vault) wallets, keyed by public key. Provided
   * per-run by the client after decrypting locally; never persisted.
   */
  signers?: Record<string, string>;
  /**
   * Ephemeral secret keys for external wallets, keyed by node id (from a
   * Connect Wallet block's private-key field). Never persisted.
   */
  nodeSecrets?: Record<string, string>;
  /** Named outputs keyed by nodeId (addresses, hashes, invoice URIs, …). */
  outputs: Record<string, Record<string, unknown>>;
  /** Persist a newly created custodial wallet (testnet). */
  saveWallet: (kp: Keypair, label: string) => Promise<void>;
  emit: (event: Omit<RunLogEvent, "at">) => void;
}

export type BlockHandler = (
  node: WorkflowNode,
  ctx: RunContext
) => Promise<void>;
