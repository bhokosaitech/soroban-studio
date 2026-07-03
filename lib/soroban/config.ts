/**
 * Network configuration for the Stellar/Soroban integration.
 *
 * The sandbox defaults to testnet. These values are also embedded into
 * generated code so exported projects target the same network the user tested
 * against.
 */
export type NetworkId = "testnet" | "mainnet";

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  networkPassphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  friendbotUrl?: string;
  explorerTx: (hash: string) => string;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerTx: (h) => `https://stellar.expert/explorer/testnet/tx/${h}`,
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://mainnet.sorobanrpc.com",
    explorerTx: (h) => `https://stellar.expert/explorer/public/tx/${h}`,
  },
};

export function getNetwork(id: NetworkId): NetworkConfig {
  return NETWORKS[id];
}
