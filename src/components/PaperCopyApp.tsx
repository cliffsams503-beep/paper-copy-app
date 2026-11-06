"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSignedUsd, formatUsd } from "@/lib/format";
import {
  applyStopTakeProfit,
  canAffordBuy,
  canAffordCopyBuy,
  closePaperSell,
  loadState,
  openCopyPaperBuy,
  openPaperBuy,
  refreshPositionMarks,
  resetPaperAccount,
  saveState,
  setSlippageRate,
  summarize,
} from "@/lib/paper";
import {
  shortenAddress,
  validatePublicSolanaAddress,
  WSOL,
} from "@/lib/solana";
import type {
  CopyDelaySeconds,
  MemeToken,
  MemesApiResponse,
  PaperState,
  Screen,
  UnsignedQuote,
} from "@/lib/types";
import { DEFAULT_STAKE_USD } from "@/lib/types";
import { CopyScreen, type CopySignal } from "./CopyScreen";
import { emptyLevels, parseLevel, type LevelsDraft } from "./LevelsFields";
import { LegalFooter } from "./LegalFooter";
import { ListScreen } from "./ListScreen";
import { PositionsScreen } from "./PositionsScreen";
import { ScoreboardScreen } from "./ScoreboardScreen";
import { TokenScreen } from "./TokenScreen";

export default function PaperCopyApp() {
  const [screen, setScreen] = useState<Screen>("list");
  const [selected, setSelected] = useState<MemeToken | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [sellPromptId, setSellPromptId] = useState<string | null>(null);
  const [memeLevels, setMemeLevels] = useState<LevelsDraft>(emptyLevels());
  const [state, setState] = useState<PaperState | null>(null);
  const [data, setData] = useState<MemesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [watchInput, setWatchInput] = useState("");
  const [watchError, setWatchError] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [copyDelay, setCopyDelay] = useState<CopyDelaySeconds>(15);
  const [signals, setSignals] = useState<CopySignal[]>([]);
  const [copyStatus, setCopyStatus] = useState<string>("Idle");
  const seenSigs = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  useEffect(() => {
    setState(loadState());
  }, []);

  const persist = useCallback((next: PaperState) => {
    setState(next);
    saveState(next);
  }, []);

  const applyMarksAndStops = useCallback(
    (
      prev: PaperState,
      quotes: Record<
        string,
        { marketCap: number | null; priceUsd: number | null }
      >
    ) => {
      const marked = refreshPositionMarks(prev, quotes);
      const { state: after, closed } = applyStopTakeProfit(marked);
      if (closed.length > 0) {
        const bits = closed.map((t) => {
          const why =
            t.closeReason === "stop"
              ? "stop-loss"
              : t.closeReason === "take_profit"
                ? "take-profit"
                : "manual";
          return `${t.symbol} ${why} ${formatSignedUsd(t.realizedPnl)}`;
        });
        setToast(
          `Auto paper-closed (estimate; periodic marks only): ${bits.join("; ")}`
        );
      }
      saveState(after);
      return after;
    },
    []
  );

  const fetchMemes = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/memes", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || `Failed (${res.status})`);
        }
        setData(json as MemesApiResponse);
        setState((prev) => {
          if (!prev) return prev;
          const quotes: Record<
            string,
            { marketCap: number | null; priceUsd: number | null }
          > = {};
          for (const t of (json as MemesApiResponse).tokens) {
            quotes[t.address] = {
              marketCap: t.marketCap,
              priceUsd: t.priceUsd,
            };
          }
          return applyMarksAndStops(prev, quotes);
        });
        setSelected((cur) => {
          if (!cur) return cur;
          const updated = (json as MemesApiResponse).tokens.find(
            (t) => t.address === cur.address
          );
          return updated ?? cur;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load memes");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [applyMarksAndStops]
  );

  useEffect(() => {
    void fetchMemes(false);
    const id = window.setInterval(() => void fetchMemes(true), 60_000);
    return () => window.clearInterval(id);
  }, [fetchMemes]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const summary = useMemo(
    () => (state ? summarize(state) : null),
    [state]
  );

  const tokenMap = useMemo(() => {
    const m = new Map<string, MemeToken>();
    data?.tokens.forEach((t) => m.set(t.address, t));
    return m;
  }, [data]);

  function openToken(token: MemeToken) {
    setSelected(token);
    setPromptOpen(false);
    setSellPromptId(null);
    setMemeLevels(emptyLevels());
    setScreen("token");
  }

  function handleYesBuy() {
    if (!state || !selected) return;
    if (!selected.priced || !selected.marketCap) {
      setToast("Unpriced — paper buy blocked.");
      return;
    }
    if (!canAffordBuy(state)) {
      setToast("Not enough virtual cash.");
      return;
    }
    setBusy(true);
    const result = openPaperBuy(state, {
      tokenAddress: selected.address,
      name: selected.name,
      symbol: selected.symbol,
      iconUrl: selected.iconUrl,
      marketCap: selected.marketCap,
      priceUsd: selected.priceUsd,
      creatorLabel: selected.creatorLabel || "Unknown creator",
      stakeUsd: DEFAULT_STAKE_USD,
      stopLossPrice: parseLevel(memeLevels.stopLossPrice),
      takeProfitPrice: parseLevel(memeLevels.takeProfitPrice),
    });
    setBusy(false);
    if (!result.ok) {
      setToast(result.reason);
      return;
    }
    persist(result.state);
    setPromptOpen(false);
    setToast(`Paper buy recorded for ${selected.symbol} (simulated).`);
    setScreen("positions");
  }

  function handleConfirmSell(positionId: string) {
    if (!state) return;
    const pos = state.positions.find((p) => p.id === positionId);
    if (!pos) return;
    const live = tokenMap.get(pos.tokenAddress);
    const exitCap =
      live?.marketCap && live.marketCap > 0
        ? live.marketCap
        : pos.lastMarketCap && pos.lastMarketCap > 0
          ? pos.lastMarketCap
          : null;
    const exitPrice =
      live?.priceUsd && live.priceUsd > 0
        ? live.priceUsd
        : pos.lastPriceUsd && pos.lastPriceUsd > 0
          ? pos.lastPriceUsd
          : null;

    if (pos.source === "copy") {
      if (
        !(exitPrice && exitPrice > 0 && pos.tokenAmount && pos.tokenAmount > 0)
      ) {
        setToast("Unpriced — paper sell blocked.");
        setSellPromptId(null);
        return;
      }
      setBusy(true);
      const result = closePaperSell(
        state,
        positionId,
        exitCap && exitCap > 0 ? exitCap : pos.entryMarketCap,
        {
          closeReason: "manual",
          exitPriceUsd: exitPrice,
          copyGrossProceedsUsd: pos.tokenAmount * exitPrice,
        }
      );
      setBusy(false);
      setSellPromptId(null);
      if (!result.ok) {
        setToast(result.reason);
        return;
      }
      persist(result.state);
      setToast(
        `Paper sold ${pos.symbol}: ${formatSignedUsd(result.trade.realizedPnl)} (simulated).`
      );
      return;
    }

    if (!exitCap) {
      setToast("Unpriced — paper sell blocked.");
      setSellPromptId(null);
      return;
    }
    setBusy(true);
    const result = closePaperSell(state, positionId, exitCap, {
      closeReason: "manual",
      exitPriceUsd: exitPrice,
    });
    setBusy(false);
    setSellPromptId(null);
    if (!result.ok) {
      setToast(result.reason);
      return;
    }
    persist(result.state);
    setToast(
      `Paper sold ${pos.symbol}: ${formatSignedUsd(result.trade.realizedPnl)} (simulated).`
    );
  }

  function resetDemo() {
    if (
      !window.confirm(
        "Reset all paper positions and restore the $10,000 virtual bankroll? Slippage preference is kept. This cannot be undone."
      )
    ) {
      return;
    }
    if (!state) return;
    persist(resetPaperAccount(state));
    setToast("Paper account reset (slippage preference kept).");
    setScreen("list");
  }

  function startWatch() {
    const check = validatePublicSolanaAddress(watchInput);
    if (!check.ok) {
      setWatchError(check.reason);
      return;
    }
    setWatchError(null);
    seenSigs.current = new Set();
    bootstrapped.current = false;
    setSignals([]);
    setWatching(check.address);
    setCopyStatus("Following (session only)…");
  }

  function stopWatch() {
    setWatching(null);
    setCopyStatus("Stopped");
    bootstrapped.current = false;
  }

  // Poll signatures gently while following (browser session only)
  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    const wallet = watching;
    const delay = copyDelay;

    async function quoteAndReady(
      signature: string,
      args: {
        direction: "BUY" | "SELL" | "TOKEN_SWAP";
        inMint: string;
        inAmount: string;
        outMint: string;
        creatorLabel: string;
        tokenMeta?: CopySignal["tokenMeta"];
      }
    ) {
      setSignals((prev) =>
        prev.map((s) =>
          s.signature === signature ? { ...s, status: "quoting" } : s
        )
      );

      const qRes = await fetch(
        `/api/copy/quote?inputMint=${encodeURIComponent(args.inMint)}&outputMint=${encodeURIComponent(args.outMint)}&amount=${encodeURIComponent(args.inAmount)}`,
        { cache: "no-store" }
      );
      const quote = (await qRes.json()) as UnsignedQuote & { error?: string };
      if (!quote.ok) {
        setSignals((prev) =>
          prev.map((s) =>
            s.signature === signature
              ? {
                  ...s,
                  status: "error",
                  quoteError: quote.error || "Quote failed",
                  reason: quote.error || "Unsigned quote unavailable",
                }
              : s
          )
        );
        return;
      }

      let tokenMeta = args.tokenMeta;
      const mintForMeta =
        args.direction === "SELL" ? args.inMint : args.outMint;
      const priorDecimals = tokenMeta?.decimals;
      try {
        const tRes = await fetch(
          `/api/token?address=${encodeURIComponent(mintForMeta)}`,
          { cache: "no-store" }
        );
        const t = await tRes.json();
        tokenMeta = {
          name: t.name || tokenMeta?.name || "Unknown token",
          symbol: t.symbol || tokenMeta?.symbol || "???",
          iconUrl: t.iconUrl || tokenMeta?.iconUrl || null,
          priceUsd: t.priceUsd ?? tokenMeta?.priceUsd ?? null,
          marketCap: t.marketCap ?? tokenMeta?.marketCap ?? null,
          decimals: priorDecimals && priorDecimals > 0 ? priorDecimals : 6,
        };
      } catch {
        tokenMeta = {
          name: tokenMeta?.name || "Unknown token",
          symbol: tokenMeta?.symbol || "???",
          iconUrl: tokenMeta?.iconUrl || null,
          priceUsd: tokenMeta?.priceUsd ?? null,
          marketCap: tokenMeta?.marketCap ?? null,
          decimals: priorDecimals && priorDecimals > 0 ? priorDecimals : 6,
        };
      }

      let costUsd: number | null = null;
      let costBlockedReason: string | null = null;
      if (args.direction === "BUY" || args.direction === "TOKEN_SWAP") {
        if (typeof quote.inUsdValue === "number" && quote.inUsdValue > 0) {
          costUsd = quote.inUsdValue;
        } else if (args.inMint === WSOL) {
          const solRes = await fetch("/api/sol-price", { cache: "no-store" });
          const sol = await solRes.json();
          if (sol.ok && sol.priceUsd > 0) {
            costUsd = (Number(args.inAmount) / 1e9) * sol.priceUsd;
          } else {
            costBlockedReason =
              "Could not price input in USD — paper buy blocked (no invented number).";
          }
        } else {
          costBlockedReason =
            "Could not price input in USD — paper buy blocked (no invented number).";
        }
      }

      setSignals((prev) =>
        prev.map((s) =>
          s.signature === signature
            ? {
                ...s,
                status: "ready",
                quote,
                tokenMeta,
                costUsd,
                costBlockedReason,
                creatorLabel: args.creatorLabel || "Unknown creator",
                direction: args.direction,
                inMint: args.inMint,
                inAmount: args.inAmount,
                outMint: args.outMint,
                promptOpen: false,
              }
            : s
        )
      );
    }

    async function handleNewSignature(signature: string) {
      setSignals((prev) =>
        [
          {
            signature,
            detectedAt: Date.now(),
            status: "waiting" as const,
            direction: null,
            inMint: null,
            inAmount: null,
            outMint: null,
            outAmount: null,
            creatorLabel: "Unknown creator",
            delaySeconds: delay,
            levels: emptyLevels(),
          },
          ...prev,
        ].slice(0, 40)
      );

      try {
        const txRes = await fetch(
          `/api/copy/tx?signature=${encodeURIComponent(signature)}&wallet=${encodeURIComponent(wallet)}`,
          { cache: "no-store" }
        );
        const parsed = await txRes.json();
        if (!parsed.parseOk) {
          setSignals((prev) =>
            prev.map((s) =>
              s.signature === signature
                ? {
                    ...s,
                    status: "unparsed",
                    reason: parsed.reason || "Unparsed",
                    creatorLabel: parsed.creatorLabel || "Unknown creator",
                  }
                : s
            )
          );
          return;
        }

        setSignals((prev) =>
          prev.map((s) =>
            s.signature === signature
              ? {
                  ...s,
                  status: "waiting",
                  direction: parsed.direction,
                  inMint: parsed.inMint,
                  inAmount: parsed.inAmount,
                  outMint: parsed.outMint,
                  outAmount: parsed.outAmount,
                  creatorLabel: parsed.creatorLabel || "Unknown creator",
                }
              : s
          )
        );

        await new Promise((r) => setTimeout(r, Math.max(0, delay * 1000 - 200)));
        if (cancelled) return;

        if (parsed.direction === "SELL") {
          setState((prevState) => {
            const held = prevState?.positions.find(
              (p) =>
                p.tokenAddress === parsed.inMint &&
                p.source === "copy" &&
                p.tokenAmount &&
                p.tokenAmount > 0
            );
            if (!held) {
              setSignals((prev) =>
                prev.map((s) =>
                  s.signature === signature
                    ? {
                        ...s,
                        status: "info",
                        reason:
                          "Watched wallet sold — you have no paper position in this token (info only).",
                      }
                    : s
                )
              );
              return prevState;
            }
            void quoteAndReady(signature, {
              direction: "SELL",
              inMint: held.tokenAddress,
              inAmount:
                held.slippedOutRaw ||
                String(
                  Math.floor(
                    (held.tokenAmount || 0) * 10 ** (held.tokenDecimals || 0)
                  )
                ),
              outMint: WSOL,
              creatorLabel: held.creatorLabel,
              tokenMeta: {
                name: held.name,
                symbol: held.symbol,
                iconUrl: held.iconUrl,
                priceUsd: held.lastPriceUsd,
                marketCap: held.lastMarketCap,
                decimals: held.tokenDecimals || 6,
              },
            });
            return prevState;
          });
          return;
        }

        if (parsed.direction !== "BUY" && parsed.direction !== "TOKEN_SWAP") {
          setSignals((prev) =>
            prev.map((s) =>
              s.signature === signature
                ? {
                    ...s,
                    status: "info",
                    reason: "Unsupported direction for paper copy.",
                  }
                : s
            )
          );
          return;
        }

        await quoteAndReady(signature, {
          direction: parsed.direction,
          inMint: parsed.inMint,
          inAmount: parsed.inAmount,
          outMint: parsed.outMint,
          creatorLabel: parsed.creatorLabel,
          tokenMeta: {
            name: "Unknown token",
            symbol: "???",
            iconUrl: null,
            priceUsd: null,
            marketCap: null,
            decimals:
              typeof parsed.outDecimals === "number"
                ? parsed.outDecimals
                : 6,
          },
        });
      } catch (e) {
        setSignals((prev) =>
          prev.map((s) =>
            s.signature === signature
              ? {
                  ...s,
                  status: "error",
                  reason: e instanceof Error ? e.message : "Failed",
                }
              : s
          )
        );
      }
    }

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/copy/signatures?address=${encodeURIComponent(wallet)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) {
          setCopyStatus(json?.error || "RPC error");
          return;
        }
        const sigs = (json.signatures || []) as Array<{
          signature: string;
          err: unknown;
        }>;
        if (!bootstrapped.current) {
          for (const s of sigs) seenSigs.current.add(s.signature);
          bootstrapped.current = true;
          setCopyStatus(
            `Watching ${shortenAddress(wallet)} · public RPC demo-grade · poll ~5s`
          );
          return;
        }
        const fresh = sigs.filter((s) => !seenSigs.current.has(s.signature));
        for (const s of fresh.reverse()) {
          seenSigs.current.add(s.signature);
          if (s.err) continue;
          void handleNewSignature(s.signature);
        }
        setCopyStatus(
          `Watching ${shortenAddress(wallet)} · last poll ok · ${seenSigs.current.size} sigs seen`
        );
      } catch (e) {
        setCopyStatus(e instanceof Error ? e.message : "Poll failed");
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [watching, copyDelay]);

  function confirmCopyBuy(sig: CopySignal) {
    if (!state || !sig.quote || !sig.tokenMeta || !watching) return;
    if (sig.direction === "SELL") {
      const pos = state.positions.find(
        (p) => p.tokenAddress === sig.inMint && p.source === "copy"
      );
      if (!pos) {
        setToast("No paper position to sell.");
        return;
      }
      const outUsd =
        typeof sig.quote.outUsdValue === "number" && sig.quote.outUsdValue > 0
          ? sig.quote.outUsdValue
          : null;
      if (!outUsd) {
        if (pos.lastPriceUsd && pos.tokenAmount) {
          setBusy(true);
          const result = closePaperSell(
            state,
            pos.id,
            pos.lastMarketCap || pos.entryMarketCap,
            {
              closeReason: "manual",
              exitPriceUsd: pos.lastPriceUsd,
              copyGrossProceedsUsd: pos.tokenAmount * pos.lastPriceUsd,
            }
          );
          setBusy(false);
          if (!result.ok) {
            setToast(result.reason);
            return;
          }
          persist(result.state);
          setSignals((prev) =>
            prev.map((s) =>
              s.signature === sig.signature
                ? { ...s, status: "dismissed", promptOpen: false }
                : s
            )
          );
          setToast(`Paper sold ${pos.symbol} (simulated copy sell).`);
          return;
        }
        setToast("Sell quote unpriced — blocked.");
        return;
      }
      setBusy(true);
      const result = closePaperSell(
        state,
        pos.id,
        pos.lastMarketCap || pos.entryMarketCap,
        {
          closeReason: "manual",
          exitPriceUsd: pos.lastPriceUsd,
          copyGrossProceedsUsd: outUsd,
        }
      );
      setBusy(false);
      if (!result.ok) {
        setToast(result.reason);
        return;
      }
      persist(result.state);
      setSignals((prev) =>
        prev.map((s) =>
          s.signature === sig.signature
            ? { ...s, status: "dismissed", promptOpen: false }
            : s
        )
      );
      setToast(
        `Paper sold ${pos.symbol}: ${formatSignedUsd(result.trade.realizedPnl)}`
      );
      return;
    }

    if (!sig.costUsd || sig.costUsd <= 0) {
      setToast(sig.costBlockedReason || "Unpriced — paper buy blocked.");
      return;
    }
    if (!canAffordCopyBuy(state, sig.costUsd)) {
      setToast("Not enough virtual cash.");
      return;
    }
    setBusy(true);
    const result = openCopyPaperBuy(state, {
      tokenAddress: sig.outMint as string,
      name: sig.tokenMeta.name,
      symbol: sig.tokenMeta.symbol,
      iconUrl: sig.tokenMeta.iconUrl,
      priceUsd: sig.tokenMeta.priceUsd,
      marketCap: sig.tokenMeta.marketCap,
      creatorLabel: sig.creatorLabel || "Unknown creator",
      costUsd: sig.costUsd,
      quotedOutRaw: sig.quote.outAmount,
      tokenDecimals: sig.tokenMeta.decimals || 6,
      watchedAddress: watching,
      copySignature: sig.signature,
      copyDelaySeconds: sig.delaySeconds,
      stopLossPrice: parseLevel(sig.levels.stopLossPrice),
      takeProfitPrice: parseLevel(sig.levels.takeProfitPrice),
    });
    setBusy(false);
    if (!result.ok) {
      setToast(result.reason);
      return;
    }
    persist(result.state);
    setSignals((prev) =>
      prev.map((s) =>
        s.signature === sig.signature
          ? { ...s, status: "dismissed", promptOpen: false }
          : s
      )
    );
    setToast(`Paper copy-buy ${sig.tokenMeta.symbol} recorded (simulated).`);
    setScreen("positions");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wallet-header">
          <div className="brand-row">
            <div className="brand">
              <h1>
                Paper <span>Copy</span>
              </h1>
              <div className="tag">Paper wallet · simulated · no real money</div>
            </div>
            {summary && (
              <div
                className={`pill ${summary.netPnl >= 0 ? "good" : "bad"}`}
                title="Virtual equity vs starting bankroll"
              >
                {formatSignedUsd(summary.netPnl)}
              </div>
            )}
          </div>
          {state && summary && (
            <div className="wallet-balance">
              <div className="wallet-chip">
                <div className="label">Virtual cash</div>
                <div className="value">{formatUsd(state.cashUsd)}</div>
              </div>
              <div className="wallet-chip">
                <div className="label">Est. equity</div>
                <div className={`value ${summary.netPnl >= 0 ? "gain" : "loss"}`}>
                  {formatUsd(summary.equity)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="banner">
          <strong>Estimates only.</strong> Market data from DexScreener / public
          Solana RPC / unsigned Jupiter quotes — not the official Pump.fun live
          board. Paper Copy is independent — not Pump.fun. No connected wallet,
          no on-chain trades. Credits are not spendable, transferable, or
          redeemable.
        </div>
        {toast && (
          <div className="banner ok" style={{ marginTop: 8 }}>
            {toast}
          </div>
        )}
      </header>

      <main className="content">
        {screen === "list" && (
          <ListScreen
            loading={loading}
            error={error}
            data={data}
            onRefresh={() => void fetchMemes(false)}
            onOpen={openToken}
          />
        )}

        {screen === "token" && selected && state && (
          <TokenScreen
            token={selected}
            state={state}
            promptOpen={promptOpen}
            busy={busy}
            levels={memeLevels}
            onLevels={setMemeLevels}
            onBack={() => {
              setPromptOpen(false);
              setScreen("list");
            }}
            onAskBuy={() => setPromptOpen(true)}
            onCancelBuy={() => setPromptOpen(false)}
            onConfirmBuy={handleYesBuy}
          />
        )}

        {screen === "copy" && state && (
          <CopyScreen
            state={state}
            watchInput={watchInput}
            watchError={watchError}
            watching={watching}
            copyDelay={copyDelay}
            copyStatus={copyStatus}
            signals={signals}
            busy={busy}
            onWatchInput={setWatchInput}
            onDelay={setCopyDelay}
            onStart={startWatch}
            onStop={stopWatch}
            onOpenPrompt={(sig) =>
              setSignals((prev) =>
                prev.map((s) =>
                  s.signature === sig.signature
                    ? { ...s, promptOpen: true }
                    : s
                )
              )
            }
            onCancelPrompt={(sig) =>
              setSignals((prev) =>
                prev.map((s) =>
                  s.signature === sig.signature
                    ? { ...s, promptOpen: false }
                    : s
                )
              )
            }
            onLevels={(sig, levels) =>
              setSignals((prev) =>
                prev.map((s) =>
                  s.signature === sig.signature ? { ...s, levels } : s
                )
              )
            }
            onConfirm={(sig) => confirmCopyBuy(sig)}
            onDismiss={(sig) =>
              setSignals((prev) =>
                prev.map((s) =>
                  s.signature === sig.signature
                    ? { ...s, status: "dismissed", promptOpen: false }
                    : s
                )
              )
            }
          />
        )}

        {screen === "positions" && state && (
          <PositionsScreen
            state={state}
            tokenMap={tokenMap}
            sellPromptId={sellPromptId}
            busy={busy}
            onAskSell={setSellPromptId}
            onCancelSell={() => setSellPromptId(null)}
            onConfirmSell={handleConfirmSell}
            onBrowse={() => setScreen("list")}
          />
        )}

        {screen === "scoreboard" && state && summary && (
          <ScoreboardScreen
            state={state}
            summary={summary}
            coverage={data?.coverage}
            feeNote={data?.feeNote}
            onReset={resetDemo}
            onSlippage={(rate) => persist(setSlippageRate(state, rate))}
          />
        )}
      </main>

      <LegalFooter />

      <nav className="nav" aria-label="Primary">
        <button
          type="button"
          className={screen === "list" || screen === "token" ? "active" : ""}
          onClick={() => {
            setPromptOpen(false);
            setScreen("list");
          }}
        >
          <span className="ico">🔥</span>
          Memes
        </button>
        <button
          type="button"
          className={screen === "copy" ? "active" : ""}
          onClick={() => setScreen("copy")}
        >
          <span className="ico">👁</span>
          Copy
        </button>
        <button
          type="button"
          className={screen === "positions" ? "active" : ""}
          onClick={() => setScreen("positions")}
        >
          <span className="ico">📈</span>
          Positions
        </button>
        <button
          type="button"
          className={screen === "scoreboard" ? "active" : ""}
          onClick={() => setScreen("scoreboard")}
        >
          <span className="ico">🏆</span>
          Score
        </button>
      </nav>
    </div>
  );
}
