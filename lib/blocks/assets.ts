/**
 * Supported assets for the asset-type fields (rendered as a dropdown).
 * Kept in sync with the backend's asset resolver (lib/server/stellar/assets.ts).
 */
export interface AssetOption {
  code: string;
  label: string;
  /** undefined = native XLM. */
  issuerTestnet?: string;
}

export const ASSETS: AssetOption[] = [
  { code: "XLM", label: "XLM (native)" },
  {
    code: "USDC",
    label: "USDC (testnet)",
    // Circle's Stellar testnet USDC issuer.
    issuerTestnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  },
];

export const ASSET_OPTIONS = ASSETS.map((a) => ({ label: a.label, value: a.code }));
