import { NextRequest, NextResponse } from "next/server";
import { validatePublicSolanaAddress } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RPC = "https://api.mainnet-beta.solana.com";

async function rpc<T>(
  method: string,
  params: unknown[]
): Promise<{ result: T | null; error?: string }> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    if (!res.ok) {
      return { result: null, error: `RPC HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      result?: T;
      error?: { message?: string };
    };
    if (json.error) {
      return { result: null, error: json.error.message || "RPC error" };
    }
    return { result: json.result ?? null };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "RPC failed",
    };
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") || "";
  const check = validatePublicSolanaAddress(address);
  if (!check.ok) {
    return NextResponse.json(
      { error: check.reason, looksLikeSecret: check.looksLikeSecret },
      { status: 400 }
    );
  }

  const { result, error } = await rpc<
    Array<{
      signature: string;
      slot: number;
      err: unknown;
      blockTime: number | null;
      confirmationStatus?: string;
    }>
  >("getSignaturesForAddress", [
    check.address,
    { limit: 20, commitment: "confirmed" },
  ]);

  if (error) {
    return NextResponse.json(
      {
        error,
        disclaimer:
          "Public Solana RPC is demo-grade and may rate-limit or lag.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    address: check.address,
    signatures: result || [],
    source: RPC,
    disclaimer:
      "Public Solana mainnet RPC — demo-grade, not a dedicated indexer. Polls only while you follow an address in this browser session.",
    fetchedAt: new Date().toISOString(),
  });
}
