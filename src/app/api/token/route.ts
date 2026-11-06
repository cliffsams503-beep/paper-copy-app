import { NextRequest, NextResponse } from "next/server";
import { validatePublicSolanaAddress } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") || "";
  const check = validatePublicSolanaAddress(address);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }
  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${check.address}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `DexScreener failed: ${res.status}` },
        { status: 502 }
      );
    }
    const pairs = (await res.json()) as Array<{
      priceUsd?: string | number;
      marketCap?: number;
      fdv?: number;
      dexId?: string;
      url?: string;
      baseToken?: { address?: string; name?: string; symbol?: string };
      info?: { imageUrl?: string };
    }>;
    const pair = Array.isArray(pairs) ? pairs[0] : null;
    const priceUsd = pair?.priceUsd != null ? Number(pair.priceUsd) : null;
    const marketCap =
      pair?.marketCap && pair.marketCap > 0
        ? pair.marketCap
        : pair?.fdv && pair.fdv > 0
          ? pair.fdv
          : null;
    const priced =
      priceUsd !== null &&
      Number.isFinite(priceUsd) &&
      priceUsd > 0 &&
      marketCap !== null &&
      marketCap > 0;

    return NextResponse.json({
      address: check.address,
      name: pair?.baseToken?.name || "Unknown token",
      symbol: pair?.baseToken?.symbol || "???",
      iconUrl: pair?.info?.imageUrl || null,
      priceUsd:
        priceUsd && Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
      marketCap,
      dexId: pair?.dexId || null,
      url: pair?.url || null,
      creatorLabel: "Unknown creator",
      priced,
      source: "DexScreener public API",
      estimateOnly: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Token lookup failed" },
      { status: 500 }
    );
  }
}
