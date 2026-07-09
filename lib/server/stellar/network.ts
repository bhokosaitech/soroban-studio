import { Horizon, rpc, Networks } from "@stellar/stellar-sdk";

/** Resolved per-network configuration + its SDK clients. */
export interface ServerNetwork {
  id: "testnet" | "mainnet";
  passphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  /** Present only on testnet — mainnet has no Friendbot. */
  friendbotUrl?: string;
  explorerTx: (hash: string) => string;
  horizon: Horizon.Server;
  sorobanRpc: rpc.Server;
}

interface NetworkSpec {
  id: "testnet" | "mainnet";
  passphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  friendbotUrl?: string;
  explorerPath: string;
}

const SPECS: Record<"testnet" | "mainnet", NetworkSpec> = {
  testnet: {
    id: "testnet",
    passphrase: Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerPath: "testnet",
  },
  mainnet: {
    id: "mainnet",
    passphrase: Networks.PUBLIC,
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://mainnet.sorobanrpc.com",
    explorerPath: "public",
  },
};

// SDK clients are relatively expensive to build, so memoize one ServerNetwork
// per network id for the process lifetime.
const cache = new Map<string, ServerNetwork>();

/** Resolve the network + SDK clients a run should execute against. */
export function getServerNetwork(id: "testnet" | "mainnet"): ServerNetwork {
  const existing = cache.get(id);
  if (existing) return existing;

  const spec = SPECS[id];
  const net: ServerNetwork = {
    id: spec.id,
    passphrase: spec.passphrase,
    horizonUrl: spec.horizonUrl,
    sorobanRpcUrl: spec.sorobanRpcUrl,
    friendbotUrl: spec.friendbotUrl,
    explorerTx: (hash: string) =>
      `https://stellar.expert/explorer/${spec.explorerPath}/tx/${hash}`,
    horizon: new Horizon.Server(spec.horizonUrl),
    sorobanRpc: new rpc.Server(spec.sorobanRpcUrl, { allowHttp: false }),
  };
  cache.set(id, net);
  return net;
}

/**
 * Testnet configuration + shared SDK clients. Retained for the vault/ephemeral
 * wallet routes (`app/api/wallets/*`), which mint testnet-only helper wallets.
 * The execution engine resolves its network per-run via `getServerNetwork`.
 */
export const NETWORK = getServerNetwork("testnet");
export const horizon = NETWORK.horizon;
export const sorobanRpc = NETWORK.sorobanRpc;
