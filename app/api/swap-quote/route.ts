import { type NextRequest, NextResponse } from "next/server";
import { getServerNetwork } from "@/lib/server/stellar/network";
import { analyzeSwap } from "@/lib/server/stellar/operations";
import { Keypair } from "@stellar/stellar-sdk";

/**
 * GET /api/swap-quote
 *
 * Fetches a real-time liquidity quote from Horizon for the given swap parameters.
 * Used by the Inspector's SwapQuotePanel to preview the swap before execution.
 *
 * Query params:
 *   sendAsset    — e.g. "XLM" or "USDC"
 *   destAsset    — e.g. "USDC" or "XLM"
 *   amount       — numeric string
 *   mode         — "exact-in" | "exact-out"
 *   slippageBps  — integer basis points (default 100 = 1%)
 *   network      — "testnet" | "mainnet"
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const sendAsset = searchParams.get("sendAsset") ?? "XLM";
  const destAsset = searchParams.get("destAsset") ?? "USDC";
  const amount = searchParams.get("amount") ?? "0";
  const mode = (searchParams.get("mode") ?? "exact-in") as "exact-in" | "exact-out";
  const slippageBps = Number(searchParams.get("slippageBps") ?? "100");
  const networkId = (searchParams.get("network") ?? "testnet") as "testnet" | "mainnet";

  // Basic validation.
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
  }
  if (sendAsset.toUpperCase() === destAsset.toUpperCase()) {
    return NextResponse.json(
      { error: "Send asset and destination asset must be different." },
      { status: 400 }
    );
  }

  try {
    const net = getServerNetwork(networkId);

    // We only need a source account for path-finding; generate a throwaway keypair
    // so we don't need the user to be authenticated just for a quote lookup.
    const ephemeral = Keypair.random();

    const quote = await analyzeSwap({
      net,
      source: ephemeral,
      sendAsset,
      destAsset,
      amount,
      mode,
      slippageBps,
    });

    // Compute a rough price impact:
    // For exact-in: how much worse than 1:1 the rate is (as a percentage).
    const sentNum = numericAmount;
    const receivedNum = Number(quote.expectedReceive);
    let priceImpactPct: number | undefined;
    if (sentNum > 0 && receivedNum > 0) {
      // Normalised rate deviation; a simple approximation. A real implementation
      // would compare against the mid-market rate from the order book.
      const expectedAtParity = sentNum;
      const deviation = Math.abs(expectedAtParity - receivedNum) / expectedAtParity;
      priceImpactPct = Math.min(deviation * 100, 100);
    }

    return NextResponse.json({
      expectedReceive: quote.expectedReceive,
      sendAmountMin: quote.sendAmountMin,
      route: quote.route,
      slippageBps: quote.slippageBps,
      priceImpactPct,
    });
  } catch (err) {
    const message = (err as Error).message ?? "Quote failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
