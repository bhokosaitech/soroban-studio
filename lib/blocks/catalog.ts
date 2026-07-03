import type { BlockDefinition } from "./types";

export { CATEGORY_META } from "./types";

/**
 * The Soroban Studio block catalog.
 *
 * Each entry is a Stellar/Soroban-native building block. Field definitions
 * feed the inspector; `network: true` marks blocks that hit Soroban RPC /
 * Horizon in the sandbox.
 *
 * Naming note: Stellar/Soroban does not ship a built-in shielded pool the way
 * Zcash does. "Confidential transfer" here maps to a confidential-token
 * (encrypted-balance) Soroban contract — kept accurate rather than implying a
 * protocol-level feature that doesn't exist.
 */
export const BLOCK_CATALOG: BlockDefinition[] = [
  // ---------------------------------------------------------------- triggers
  {
    type: "trigger-manual",
    label: "Manual Trigger",
    category: "trigger",
    description: "Start the workflow when a user initiates it (button, API call).",
    icon: "Play",
    handles: { target: false, source: true },
    fields: [
      {
        key: "name",
        label: "Trigger name",
        type: "text",
        placeholder: "start",
        default: "start",
      },
    ],
  },
  {
    type: "wait-for-payment",
    label: "Wait for Payment",
    category: "trigger",
    description:
      "Pause until a payment matching an amount/asset arrives at an address.",
    icon: "Hourglass",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "address", label: "Watch address", type: "address", required: true },
      { key: "asset", label: "Asset", type: "asset", default: "XLM" },
      { key: "amount", label: "Expected amount", type: "number", placeholder: "10" },
      {
        key: "timeout",
        label: "Timeout (seconds)",
        type: "number",
        default: 300,
        help: "Fail the branch if no payment arrives in time.",
      },
    ],
  },

  // ------------------------------------------------------------------ wallet
  {
    type: "create-wallet",
    label: "Create Wallet",
    category: "wallet",
    description: "Generate a new Stellar keypair (account) for the user.",
    icon: "Wallet",
    handles: { target: true, source: true },
    fields: [
      {
        key: "fund",
        label: "Fund on testnet (Friendbot)",
        type: "boolean",
        default: true,
        help: "Auto-fund the new account with test XLM in the sandbox.",
      },
    ],
  },
  {
    type: "connect-wallet",
    label: "Connect Wallet",
    category: "wallet",
    description: "Connect an external wallet by secret key (or auto-provision one in the sandbox).",
    icon: "Plug",
    handles: { target: true, source: true },
    fields: [
      {
        key: "secretKey",
        label: "Private key",
        type: "secret",
        placeholder: "S… (external wallet secret)",
        help: "Paste a secret key to sign with your own wallet. Used only at run time — never saved to the server, the workflow file, or exports.",
      },
      {
        key: "network",
        label: "Network",
        type: "select",
        default: "testnet",
        options: [
          { label: "Testnet", value: "testnet" },
          { label: "Mainnet", value: "mainnet" },
        ],
      },
    ],
  },
  {
    type: "use-wallet",
    label: "Use Saved Wallet",
    category: "wallet",
    description: "Sign with a wallet from your encrypted vault (reusable across workflows).",
    icon: "KeyRound",
    handles: { target: true, source: true },
    fields: [
      {
        key: "publicKey",
        label: "Saved wallet",
        type: "wallet",
        required: true,
        help: "Unlock your vault to pick a wallet. Its secret is decrypted locally at run time.",
      },
    ],
  },
  {
    type: "generate-address",
    label: "Generate Address",
    category: "wallet",
    description:
      "Derive a receiving address, optionally a muxed (M...) address per user/invoice.",
    icon: "AtSign",
    handles: { target: true, source: true },
    fields: [
      {
        key: "muxed",
        label: "Muxed (per-user) address",
        type: "boolean",
        default: false,
        help: "Encode a user id into a single shared account (SEP-23 M-address).",
      },
      { key: "memoId", label: "Muxed id", type: "number", placeholder: "1001" },
    ],
  },

  // ----------------------------------------------------------------- payment
  {
    type: "send-payment",
    label: "Send Payment",
    category: "payment",
    description: "Send XLM or an issued asset from one account to another.",
    icon: "Send",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "destination", label: "Destination", type: "address", required: true },
      { key: "asset", label: "Asset", type: "asset", default: "XLM" },
      { key: "amount", label: "Amount", type: "number", required: true, placeholder: "10" },
      { key: "memo", label: "Memo", type: "text", placeholder: "invoice #1001" },
    ],
  },
  {
    type: "confidential-transfer",
    label: "Confidential Transfer",
    category: "payment",
    description:
      "Move value with an encrypted-balance (confidential) token contract on Soroban.",
    icon: "ShieldCheck",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "contractId", label: "Token contract", type: "text", required: true, placeholder: "C..." },
      { key: "destination", label: "Destination", type: "address", required: true },
      { key: "amount", label: "Amount", type: "number", required: true },
    ],
  },
  {
    type: "receive-payment",
    label: "Receive Payment",
    category: "payment",
    description: "Expose a payment request / address and capture the incoming payment.",
    icon: "Download",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "asset", label: "Asset", type: "asset", default: "XLM" },
      { key: "amount", label: "Requested amount", type: "number" },
    ],
  },
  {
    type: "create-invoice",
    label: "Create Invoice",
    category: "payment",
    description: "Generate a payment request (amount, asset, memo) and a shareable link.",
    icon: "ReceiptText",
    handles: { target: true, source: true },
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "asset", label: "Asset", type: "asset", default: "USDC" },
      { key: "reference", label: "Reference", type: "text", placeholder: "ORDER-42" },
    ],
  },

  // ------------------------------------------------------------------- asset
  {
    type: "establish-trustline",
    label: "Add Trustline",
    category: "asset",
    description: "Establish a trustline so an account can hold USDC.",
    icon: "Link2",
    network: true,
    handles: { target: true, source: true },
    fields: [
      {
        key: "assetCode",
        label: "Asset",
        type: "select",
        default: "USDC",
        options: [{ label: "USDC (testnet)", value: "USDC" }],
        help: "Only USDC is supported on testnet.",
      },
      {
        key: "issuer",
        label: "Issuer",
        type: "text",
        default: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA",
        help: "Circle's USDC testnet issuer (pre-filled).",
      },
    ],
  },
  {
    type: "swap-asset",
    label: "Swap Asset",
    category: "asset",
    description: "Path-payment swap between two assets on the Stellar DEX.",
    icon: "ArrowLeftRight",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "sendAsset", label: "From asset", type: "asset", default: "XLM" },
      { key: "destAsset", label: "To asset", type: "asset", default: "USDC" },
      { key: "amount", label: "Amount", type: "number", required: true },
    ],
  },

  // ---------------------------------------------------------------- contract
  {
    type: "invoke-contract",
    label: "Invoke Contract",
    category: "contract",
    description: "Call a function on a deployed Soroban smart contract.",
    icon: "FunctionSquare",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "contractId", label: "Contract ID", type: "text", required: true, placeholder: "C..." },
      { key: "method", label: "Function", type: "text", required: true, placeholder: "transfer" },
      { key: "args", label: "Arguments (JSON)", type: "text", placeholder: '["...", 100]' },
    ],
  },
  {
    type: "deploy-contract",
    label: "Deploy Contract",
    category: "contract",
    description: "Upload and instantiate a Soroban WASM contract.",
    icon: "UploadCloud",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "wasmHash", label: "WASM hash / path", type: "text", required: true },
    ],
  },
  {
    type: "verify-transaction",
    label: "Verify Transaction",
    category: "contract",
    description: "Confirm a transaction succeeded and read its result / events.",
    icon: "BadgeCheck",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "hash", label: "Transaction hash", type: "text", required: true },
    ],
  },

  // -------------------------------------------------------------- automation
  {
    type: "condition",
    label: "Condition",
    category: "automation",
    description: "Branch the workflow based on a comparison (if / else).",
    icon: "GitBranch",
    handles: { target: true, source: true },
    fields: [
      { key: "left", label: "Left value", type: "text", placeholder: "{{balance}}" },
      {
        key: "op",
        label: "Operator",
        type: "select",
        default: "gte",
        options: [
          { label: "≥", value: "gte" },
          { label: "≤", value: "lte" },
          { label: "=", value: "eq" },
          { label: "≠", value: "neq" },
        ],
      },
      { key: "right", label: "Right value", type: "text", placeholder: "10" },
    ],
  },
  {
    type: "trigger-webhook",
    label: "Trigger Webhook",
    category: "automation",
    description: "POST workflow data to an external URL when this step runs.",
    icon: "Webhook",
    network: true,
    handles: { target: true, source: true },
    fields: [
      { key: "url", label: "Webhook URL", type: "text", required: true, placeholder: "https://..." },
      {
        key: "method",
        label: "Method",
        type: "select",
        default: "POST",
        options: [
          { label: "POST", value: "POST" },
          { label: "PUT", value: "PUT" },
        ],
      },
    ],
  },
  {
    type: "delay",
    label: "Delay",
    category: "automation",
    description: "Wait a fixed amount of time before continuing.",
    icon: "Timer",
    handles: { target: true, source: true },
    fields: [{ key: "seconds", label: "Seconds", type: "number", default: 5 }],
  },

  // ------------------------------------------------------------------ output
  {
    type: "on-success",
    label: "On Success",
    category: "output",
    description: "Terminal node — the workflow completed successfully.",
    icon: "CircleCheck",
    handles: { target: true, source: false },
    fields: [
      { key: "message", label: "Message", type: "text", placeholder: "Payment complete" },
    ],
  },
  {
    type: "on-error",
    label: "On Error",
    category: "output",
    description: "Terminal node — handle a failed step.",
    icon: "CircleX",
    handles: { target: true, source: false },
    fields: [
      { key: "message", label: "Message", type: "text", placeholder: "Something went wrong" },
    ],
  },
];

/** Fast lookup by block type. */
export const BLOCK_BY_TYPE: Record<string, BlockDefinition> = Object.fromEntries(
  BLOCK_CATALOG.map((b) => [b.type, b])
);

export function getBlock(type: string): BlockDefinition | undefined {
  return BLOCK_BY_TYPE[type];
}

/** Default field values for a freshly-dropped block. */
export function defaultData(type: string): Record<string, unknown> {
  const block = getBlock(type);
  if (!block) return {};
  const data: Record<string, unknown> = {};
  for (const f of block.fields) {
    if (f.default !== undefined) data[f.key] = f.default;
  }
  return data;
}
