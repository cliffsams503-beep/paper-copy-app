import { NextResponse } from "next/server";
import { WSOL } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // DexScreener public token endpoint for wrapped SOL.
    const url = `https://api.dexscreener.com/tokens/v1/solana/${WSOL}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `DexScreener SOL price failed: ${res.status}` },
        { status: 502 }
      );
    }
    const pairs = (await res.json()) as Array<{
      priceUsd?: string | number;
      baseToken?: { address?: string };
    }>;
    let priceUsd: number | null = null;
    if (Array.isArray(pairs)) {
      for (const p of pairs) {
        const n =
          typeof p.priceUsd === "number" ? p.priceUsd : Number(p.priceUsd);
        if (Number.isFinite(n) && n > 0) {
          priceUsd = n;
          break;
        }
      }
    }
    if (!priceUsd) {
      return NextResponse.json(
        {
          ok: false,
          error: "SOL/USD unpriced from DexScreener — cannot invent a number.",
          priceUsd: null,
        },
        { status: 200 }
      );
    }
    return NextResponse.json({
      ok: true,
      priceUsd,
      mint: WSOL,
      source: "DexScreener public API (wSOL)",
      fetchedAt: new Date().toISOString(),
      estimateOnly: true,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "SOL price failed",
        priceUsd: null,
      },
      { status: 500 }
    );
  }
}
