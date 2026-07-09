import { Asset } from "@stellar/stellar-sdk";

/**
 * Asset resolver — mirrors the frontend list (lib/blocks/assets.ts).
 * USDC uses Circle's Stellar testnet issuer.
 */
const USDC_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA";

export function resolveAsset(code: string | undefined): Asset {
  const c = (code ?? "XLM").toUpperCase();
  if (c === "XLM" || c === "NATIVE") return Asset.native();
  if (c === "USDC") return new Asset("USDC", USDC_TESTNET_ISSUER);
  // Unknown code: treat as native to avoid crashing a run.
  return Asset.native();
}

export function isNative(code: string | undefined): boolean {
  const c = (code ?? "XLM").toUpperCase();
  return c === "XLM" || c === "NATIVE";
}
