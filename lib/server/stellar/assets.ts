import { Asset } from "@stellar/stellar-sdk";

/**
 * Asset resolver — mirrors the frontend list (lib/blocks/assets.ts).
 *
 * All issuers here are the well-known testnet issuers.  On mainnet the
 * swap handler will need a different issuer map; for now testnet is the
 * primary target network.
 */

// Known testnet issuers
const TESTNET_ISSUERS: Record<string, string> = {
  USDC: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  // Add more known assets here as the catalog grows.
};

export function resolveAsset(code: string | undefined): Asset {
  const c = (code ?? "XLM").toUpperCase().trim();
  if (c === "XLM" || c === "NATIVE") return Asset.native();

  // Handle "CODE:ISSUER" format so callers can pass a fully-qualified asset.
  if (c.includes(":")) {
    const [assetCode, issuer] = c.split(":");
    return new Asset(assetCode, issuer);
  }

  // Look up the known issuer for this code.
  const issuer = TESTNET_ISSUERS[c];
  if (issuer) return new Asset(c, issuer);

  // Unknown code: native fallback avoids crashing. Log a warning in development.
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[resolveAsset] Unknown asset code "${c}" — falling back to native XLM.`);
  }
  return Asset.native();
}

export function isNative(code: string | undefined): boolean {
  const c = (code ?? "XLM").toUpperCase().trim();
  return c === "XLM" || c === "NATIVE";
}
