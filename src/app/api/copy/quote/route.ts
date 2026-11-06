import { NextRequest, NextResponse } from "next/server";
import { validatePublicSolanaAddress } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JUP = "https://lite-api.jup.ag/swap/v2/order";

export async function GET(req: NextRequest) {
  const inputMint = req.nextUrl.searchParams.get("inputMint") || "";
  const outputMint = req.nextUrl.searchParams.get("outputMint") || "";
  const amount = req.nextUrl.searchParams.get("amount") || "";

  const inCheck = validatePublicSolanaAddress(inputMint);
  const outCheck = validatePublicSolanaAddress(outputMint);
  if (!inCheck.ok || !outCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "inputMint and outputMint must be public mint addresses." },
      { status: 400 }
    );
  }
  if (!/^\d+$/.test(amount) || amount === "0") {
    return NextResponse.json(
      { ok: false, error: "amount must be a positive integer (smallest units)." },
      { status: 400 }
    );
  }

  // Intentionally omit `taker` so Jupiter returns a quote with transaction: null.
  const url = new URL(JUP);
  url.searchParams.set("inputMint", inCheck.address);
  url.searchParams.set("outputMint", outCheck.address);
  url.searchParams.set("amount", amount);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as Record<string, unknown>;

    // Hard safety: never forward a transaction blob to the client.
    if ("transaction" in json && json.transaction != null) {
      json.transaction = null;
    }
    delete json.transaction;

    if (!res.ok || typeof json.outAmount !== "string") {
      return NextResponse.json(
        {
          ok: false,
          estimateOnly: true,
          error:
            typeof json.error === "string"
              ? json.error
              : `Jupiter quote failed (${res.status})`,
          transactionIsNull: true,
        },
        { status: 200 }
      );
    }

    const routes: string[] = [];
    const plan = json.routePlan;
    if (Array.isArray(plan)) {
      for (const step of plan) {
        const label =
          step &&
          typeof step === "object" &&
          "swapInfo" in step &&
          step.swapInfo &&
          typeof step.swapInfo === "object" &&
          "label" in step.swapInfo
            ? String((step.swapInfo as { label?: string }).label || "")
            : "";
        if (label) routes.push(label);
      }
    }

    return NextResponse.json({
      ok: true,
      estimateOnly: true as const,
      inputMint: inCheck.address,
      outputMint: outCheck.address,
      inAmount: String(json.inAmount ?? amount),
      outAmount: String(json.outAmount),
      inUsdValue:
        typeof json.inUsdValue === "number" ? json.inUsdValue : null,
      outUsdValue:
        typeof json.outUsdValue === "number" ? json.outUsdValue : null,
      priceImpact:
        typeof json.priceImpact === "number" ? json.priceImpact : null,
      router: typeof json.router === "string" ? json.router : null,
      feeBps: typeof json.feeBps === "number" ? json.feeBps : null,
      routes,
      transactionIsNull: true,
      label:
        "Unsigned Jupiter estimate only — not a guaranteed fill. No transaction created or signed.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        estimateOnly: true,
        error: e instanceof Error ? e.message : "Quote failed",
        transactionIsNull: true,
      },
      { status: 502 }
    );
  }
}
