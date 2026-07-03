import { create } from "zustand";
import { decryptSecret, encryptSecret, type CipherPayload } from "./crypto";

/**
 * Encrypted wallet vault, persisted to localStorage.
 *
 * Only public metadata + ciphertext are stored. The password lives in memory
 * for the session (never persisted) and is required to decrypt secrets. A
 * "verifier" ciphertext lets us check the password without storing it.
 */

const STORAGE_KEY = "soroban-studio-vault";
const VERIFIER_PLAINTEXT = "soroban-studio-vault-v1";

export interface VaultWallet {
  publicKey: string;
  label: string;
  network: string;
  cipher: CipherPayload;
  createdAt: number;
}

interface VaultData {
  version: 1;
  verifier: CipherPayload | null;
  wallets: VaultWallet[];
}

function read(): VaultData {
  if (typeof window === "undefined") return { version: 1, verifier: null, wallets: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VaultData;
  } catch {
    /* fall through to empty */
  }
  return { version: 1, verifier: null, wallets: [] };
}

function write(data: VaultData) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

interface VaultState {
  /** A vault has been created (verifier present). */
  initialized: boolean;
  /** Password entered this session. */
  unlocked: boolean;
  wallets: VaultWallet[];
  /** In-memory only — never persisted. */
  _password: string | null;

  load: () => void;
  createVault: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  addWallet: (w: { publicKey: string; label: string; network: string; secret: string }) => Promise<void>;
  removeWallet: (publicKey: string) => void;
  getSecret: (publicKey: string) => Promise<string>;
  getSigners: (publicKeys: string[]) => Promise<Record<string, string>>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  initialized: false,
  unlocked: false,
  wallets: [],
  _password: null,

  load: () => {
    const data = read();
    set({ initialized: !!data.verifier, wallets: data.wallets });
  },

  createVault: async (password) => {
    const verifier = await encryptSecret(VERIFIER_PLAINTEXT, password);
    const data: VaultData = { version: 1, verifier, wallets: [] };
    write(data);
    set({ initialized: true, unlocked: true, wallets: [], _password: password });
  },

  unlock: async (password) => {
    const data = read();
    if (!data.verifier) return false;
    try {
      const check = await decryptSecret(data.verifier, password);
      if (check !== VERIFIER_PLAINTEXT) return false;
    } catch {
      return false; // wrong password → GCM auth failure
    }
    set({ unlocked: true, wallets: data.wallets, _password: password });
    return true;
  },

  lock: () => set({ unlocked: false, _password: null }),

  addWallet: async ({ publicKey, label, network, secret }) => {
    const password = get()._password;
    if (!password) throw new Error("Vault is locked.");
    if (get().wallets.some((w) => w.publicKey === publicKey)) return;
    const cipher = await encryptSecret(secret, password);
    const wallet: VaultWallet = { publicKey, label, network, cipher, createdAt: Date.now() };
    const data = read();
    data.wallets = [wallet, ...data.wallets.filter((w) => w.publicKey !== publicKey)];
    write(data);
    set({ wallets: data.wallets });
  },

  removeWallet: (publicKey) => {
    const data = read();
    data.wallets = data.wallets.filter((w) => w.publicKey !== publicKey);
    write(data);
    set({ wallets: data.wallets });
  },

  getSecret: async (publicKey) => {
    const password = get()._password;
    if (!password) throw new Error("Vault is locked.");
    const wallet = get().wallets.find((w) => w.publicKey === publicKey);
    if (!wallet) throw new Error(`No saved wallet ${publicKey}.`);
    return decryptSecret(wallet.cipher, password);
  },

  getSigners: async (publicKeys) => {
    const out: Record<string, string> = {};
    for (const pk of publicKeys) {
      try {
        out[pk] = await get().getSecret(pk);
      } catch {
        /* skip unknown/locked */
      }
    }
    return out;
  },
}));
