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
    issuerTestnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA",
  },
];

export const ASSET_OPTIONS = ASSETS.map((a) => ({ label: a.label, value: a.code }));
