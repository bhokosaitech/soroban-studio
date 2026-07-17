/**
 * Block system types.
 *
 * A "block" is a reusable, Soroban/Stellar-native step that users drag onto
 * the canvas. The catalog (see ./catalog.ts) is the single source of truth
 * that the editor palette, the node inspector, the AI Builder, and the code
 * generator all read from.
 */

export type BlockCategory =
  | "trigger"
  | "wallet"
  | "payment"
  | "asset"
  | "contract"
  | "automation"
  | "output";

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "address"
  | "asset"
  | "wallet"
  | "secret"
  | "list";

/** A configurable parameter shown in the node inspector. */
export interface BlockField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  default?: string | number | boolean | string[];
  /** Options for `select` fields. */
  options?: { label: string; value: string }[];
  /**
   * Only show this field when another field has one of these values. Lets a
   * block reveal fields based on earlier choices (e.g. a "custom value" input
   * that only appears when the check is set to "custom").
   */
  showIf?: { field: string; in: string[] };
  /**
   * Disable (and force off) this field when the workflow targets mainnet. Used
   * for testnet-only capabilities like Friendbot auto-funding.
   */
  disabledOnMainnet?: boolean;
}

/** How many connection points a block exposes. */
export interface BlockHandles {
  /** Accepts an incoming connection (most blocks do; triggers do not). */
  target: boolean;
  /** Emits outgoing connections. `false` for terminal/output blocks. */
  source: boolean;
}

export interface BlockDefinition {
  /** Stable machine id, e.g. "send-payment". Used as the React Flow node type. */
  type: string;
  label: string;
  category: BlockCategory;
  description: string;
  /** lucide-react icon name. */
  icon: string;
  fields: BlockField[];
  handles: BlockHandles;
  /**
   * Named source outputs for branching blocks (e.g. a condition's pass/fail).
   * When present, the node renders one labelled source handle per output and
   * the executor follows only the branch that matches the block's result.
   */
  outputs?: { id: string; label: string; color: string }[];
  /**
   * Whether this block performs a real network operation in the sandbox
   * (vs. a pure client-side/logic step). Drives sandbox execution + costing.
   */
  network?: boolean;
}

export const CATEGORY_META: Record<
  BlockCategory,
  { label: string; colorVar: string; dot: string }
> = {
  trigger: { label: "Triggers", colorVar: "--ink", dot: "#111110" },
  wallet: { label: "Wallet", colorVar: "--node-wallet", dot: "#1a6cf2" },
  payment: { label: "Payments", colorVar: "--node-payment", dot: "#16a34a" },
  asset: { label: "Assets", colorVar: "--node-asset", dot: "#d97706" },
  contract: { label: "Contracts", colorVar: "--node-contract", dot: "#7c3aed" },
  automation: { label: "Automation", colorVar: "--node-automation", dot: "#db2777" },
  output: { label: "Output", colorVar: "--muted", dot: "#6b6a66" },
};
