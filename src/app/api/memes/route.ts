import { NextResponse } from "next/server";
import type { MemeToken, MemesApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Profile = {
  url?: string;
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
  description?: string;
};

type Pair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string | number;
  marketCap?: number;
  fdv?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { imageUrl?: string };
};

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const profilesRes = await fetch(
      "https://api.dexscreener.com/token-profiles/latest/v1",
      { cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!profilesRes.ok) {
      return NextResponse.json(
        { error: `DexScreener profiles failed: ${profilesRes.status}` },
        { status: 502 }
      );
    }
    const profiles = (await profilesRes.json()) as Profile[];
    const solana = (Array.isArray(profiles) ? profiles : []).filter(
      (p) => p.chainId === "solana" && typeof p.tokenAddress === "string"
    );

    // Dedupe while preserving order
    const seen = new Set<string>();
    const unique: Profile[] = [];
    for (const p of solana) {
      const addr = p.tokenAddress as string;
      if (seen.has(addr)) continue;
      seen.add(addr);
      unique.push(p);
    }

    const addresses = unique.map((p) => p.tokenAddress as string);
    const pairByAddress = new Map<string, Pair>();

    // Docs: tokens/v1/{chain}/{addresses} — batch reasonably (≤30 common)
    const CHUNK = 30;
    for (let i = 0; i < addresses.length; i += CHUNK) {
      const chunk = addresses.slice(i, i + CHUNK);
      const url = `https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`;
      const pairsRes = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!pairsRes.ok) {
        return NextResponse.json(
          { error: `DexScreener tokens failed: ${pairsRes.status}` },
          { status: 502 }
        );
      }
      const pairs = (await pairsRes.json()) as Pair[];
      if (Array.isArray(pairs)) {
        for (const pair of pairs) {
          const addr = pair.baseToken?.address;
          if (!addr) continue;
          // Prefer first pair; prefer one that has marketCap if replacing empty
          const existing = pairByAddress.get(addr);
          const cap = parseNum(pair.marketCap) ?? parseNum(pair.fdv);
          if (!existing) {
            pairByAddress.set(addr, pair);
          } else {
            const existingCap =
              parseNum(existing.marketCap) ?? parseNum(existing.fdv);
            if ((existingCap === null || existingCap <= 0) && cap && cap > 0) {
              pairByAddress.set(addr, pair);
            }
          }
        }
      }
    }

    const tokens: MemeToken[] = unique.map((profile) => {
      const address = profile.tokenAddress as string;
      const pair = pairByAddress.get(address);
      const priceUsd = parseNum(pair?.priceUsd);
      const marketCap =
        parseNum(pair?.marketCap) ?? parseNum(pair?.fdv);
      const priced =
        priceUsd !== null &&
        priceUsd > 0 &&
        marketCap !== null &&
        marketCap > 0;

      return {
        address,
        name: pair?.baseToken?.name || "Unknown token",
        symbol: pair?.baseToken?.symbol || "???",
        iconUrl: pair?.info?.imageUrl || profile.icon || null,
        priceUsd: priced ? priceUsd : priceUsd && priceUsd > 0 ? priceUsd : null,
        marketCap: priced ? marketCap : marketCap && marketCap > 0 ? marketCap : null,
        dexId: pair?.dexId || null,
        url: pair?.url || profile.url || null,
        // DexScreener public payloads do not reliably expose a creator identity
        creatorLabel: "Unknown creator",
        priced:
          (priceUsd !== null && priceUsd > 0 && marketCap !== null && marketCap > 0) ||
          false,
      };
    });

    // Normalize priced flag strictly: both price and market cap required
    for (const t of tokens) {
      t.priced =
        t.priceUsd !== null &&
        t.priceUsd > 0 &&
        t.marketCap !== null &&
        t.marketCap > 0;
      if (!t.priced) {
        // Keep raw values null so UI cannot invent buys from partial data
        if (!(t.marketCap !== null && t.marketCap > 0)) t.marketCap = null;
        if (!(t.priceUsd !== null && t.priceUsd > 0)) t.priceUsd = null;
        t.priced = Boolean(
          t.priceUsd && t.priceUsd > 0 && t.marketCap && t.marketCap > 0
        );
      }
    }

    const priced = tokens.filter((t) => t.priced).length;
    const body: MemesApiResponse = {
      source: "DexScreener public API (token-profiles/latest + tokens/v1/solana)",
      disclaimer:
        "Market data from DexScreener — not the official Pump.fun live board. Prices and market caps are estimates, not guaranteed fills. Simulated paper trading only.",
      fetchedAt: new Date().toISOString(),
      tokens,
      coverage: {
        listed: tokens.length,
        priced,
        unpriced: tokens.length - priced,
      },
      feeNote:
        "Paper creator fee 0.300% — Pump.fun documented bonding-curve creator fee (pump.fun/docs/fees, updated 17 Oct 2026). Scoreboard-only; not paid on-chain.",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
