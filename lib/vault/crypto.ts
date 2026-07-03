/**
 * Client-side secret encryption for the wallet vault.
 *
 * Password → key via PBKDF2 (SHA-256, 210k iterations) → AES-256-GCM. Each
 * secret gets a random salt + IV. Nothing here ever touches the network; the
 * password is never stored. Wrong passwords fail authentication in GCM, so
 * decrypt throws rather than returning garbage.
 */

const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH = 256;

export interface CipherPayload {
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 ciphertext (+ GCM tag)
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(plaintext: string, password: string): Promise<CipherPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext)
  );
  return { salt: toB64(salt.buffer), iv: toB64(iv.buffer), ct: toB64(ct) };
}

export async function decryptSecret(payload: CipherPayload, password: string): Promise<string> {
  const salt = fromB64(payload.salt);
  const iv = fromB64(payload.iv);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    fromB64(payload.ct) as BufferSource
  );
  return dec.decode(plain);
}
