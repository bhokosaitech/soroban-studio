import { Horizon, rpc, Networks } from "@stellar/stellar-sdk";

/** Testnet configuration + shared SDK clients. */
export const NETWORK = {
  id: "testnet" as const,
  passphrase: Networks.TESTNET,
  horizonUrl: "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
  explorerTx: (hash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${hash}`,
};

export const horizon = new Horizon.Server(NETWORK.horizonUrl);
export const sorobanRpc = new rpc.Server(NETWORK.sorobanRpcUrl, {
  allowHttp: false,
});
