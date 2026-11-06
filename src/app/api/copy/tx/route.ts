import { NextRequest, NextResponse } from "next/server";
import {
  parseSwapTransaction,
  validatePublicSolanaAddress,
} from "@/lib/solana";

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
    if (!res.ok) return { result: null, error: `RPC HTTP ${res.status}` };
    const json = (await res.json()) as {
      result?: T;
      error?: { message?: string };
    };
    if (json.error) {
      return { result: null, error: json.error.message || "RPC error" };
    }
    return { result: (json.result as T) ?? null };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "RPC failed",
    };
  }
}

export async function GET(req: NextRequest) {
  const signature = req.nextUrl.searchParams.get("signature") || "";
  const walletRaw = req.nextUrl.searchParams.get("wallet") || "";
  if (!signature || signature.length < 32) {
    return NextResponse.json(
      { error: "Missing transaction signature." },
      { status: 400 }
    );
  }
  const check = validatePublicSolanaAddress(walletRaw);
  if (!check.ok) {
    return NextResponse.json(
      { error: check.reason, looksLikeSecret: check.looksLikeSecret },
      { status: 400 }
    );
  }

  const { result: tx, error } = await rpc<Record<string, unknown>>(
    "getTransaction",
    [
      signature,
      {
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      },
    ]
  );

  if (error) {
    return NextResponse.json({ error }, { status: 502 });
  }
  if (!tx) {
    return NextResponse.json(
      {
        parseOk: false,
        signature,
        reason: "Transaction not available yet (public RPC lag).",
        unparsed: true,
      },
      { status: 200 }
    );
  }

  const parsed = parseSwapTransaction(
    signature,
    tx as Parameters<typeof parseSwapTransaction>[1],
    check.address
  );

  return NextResponse.json({
    ...parsed,
    unparsed: !parsed.parseOk,
    disclaimer:
      "Parse is best-effort from public RPC. Unparsed txs are shown as-is — we do not invent mint, size, or fill.",
    estimateOnly: true,
  });
}
