import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { prisma } from "../db.js";
import { fundWithFriendbot } from "../stellar/operations.js";

export const walletsRouter = Router();

/** List sandbox wallets (public info only — never expose secrets). */
walletsRouter.get("/", async (_req, res) => {
  const wallets = await prisma.wallet.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, publicKey: true, network: true, label: true, funded: true, createdAt: true },
  });
  res.json(wallets);
});

/**
 * Create + fund a testnet wallet and return its secret WITHOUT persisting it.
 * For the client-side encrypted vault: the browser encrypts the secret with the
 * user's password and stores it in localStorage — the server keeps nothing.
 */
walletsRouter.post("/ephemeral", async (_req, res) => {
  const kp = Keypair.random();
  try {
    await fundWithFriendbot(kp.publicKey());
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message });
  }
  res.json({ publicKey: kp.publicKey(), secret: kp.secret(), network: "testnet" });
});

/** Create + fund a new testnet wallet (server-custodied). */
walletsRouter.post("/", async (req, res) => {
  const kp = Keypair.random();
  try {
    await fundWithFriendbot(kp.publicKey());
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message });
  }
  const wallet = await prisma.wallet.create({
    data: {
      publicKey: kp.publicKey(),
      secret: kp.secret(),
      network: "testnet",
      label: typeof req.body?.label === "string" ? req.body.label : null,
      funded: true,
    },
    select: { id: true, publicKey: true, network: true, label: true, funded: true, createdAt: true },
  });
  res.json(wallet);
});
