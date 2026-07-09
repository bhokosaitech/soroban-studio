import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { prisma } from "@/lib/server/db";
import { fundWithFriendbot } from "@/lib/server/stellar/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/wallets — list sandbox wallets (public info only, never secrets). */
export async function GET() {
  const wallets = await prisma.wallet.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, publicKey: true, network: true, label: true, funded: true, createdAt: true },
  });
  return NextResponse.json(wallets);
}

/** POST /api/wallets — create + fund a new testnet wallet (server-custodied). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kp = Keypair.random();
  try {
    await fundWithFriendbot(kp.publicKey());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  const wallet = await prisma.wallet.create({
    data: {
      publicKey: kp.publicKey(),
      secret: kp.secret(),
      network: "testnet",
      label: typeof body?.label === "string" ? body.label : null,
      funded: true,
    },
    select: { id: true, publicKey: true, network: true, label: true, funded: true, createdAt: true },
  });
  return NextResponse.json(wallet);
}
