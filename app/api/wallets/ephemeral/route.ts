import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { NETWORK } from "@/lib/server/stellar/network";
import { fundWithFriendbot } from "@/lib/server/stellar/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/wallets/ephemeral — create + fund a testnet wallet and return its
 * secret WITHOUT persisting it. For the client-side encrypted vault: the browser
 * encrypts the secret with the user's password and stores it in localStorage —
 * the server keeps nothing.
 */
export async function POST() {
  const kp = Keypair.random();
  try {
    await fundWithFriendbot(NETWORK, kp.publicKey());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  return NextResponse.json({ publicKey: kp.publicKey(), secret: kp.secret(), network: "testnet" });
}
