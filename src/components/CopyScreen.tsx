"use client";

import { formatUsd } from "@/lib/format";
import { canAffordCopyBuy, slippedTokenAmount } from "@/lib/paper";
import { shortenAddress } from "@/lib/solana";
import type { CopyDelaySeconds, PaperState, UnsignedQuote } from "@/lib/types";
import { LevelsDraft, LevelsFields } from "./LevelsFields";

export type CopySignal = {
  signature: string;
  detectedAt: number;
  status:
    | "detected"
    | "waiting"
    | "quoting"
    | "ready"
    | "unparsed"
    | "info"
    | "error"
    | "dismissed";
  direction: "BUY" | "SELL" | "TOKEN_SWAP" | null;
  inMint: string | null;
  inAmount: string | null;
  outMint: string | null;
  outAmount: string | null;
  creatorLabel: string;
  reason?: string;
  quote?: UnsignedQuote | null;
  quoteError?: string;
  tokenMeta?: {
    name: string;
    symbol: string;
    iconUrl: string | null;
    priceUsd: number | null;
    marketCap: number | null;
    decimals: number;
  } | null;
  costUsd?: number | null;
  costBlockedReason?: string | null;
  delaySeconds: CopyDelaySeconds;
  promptOpen?: boolean;
  levels: LevelsDraft;
};

export function CopyScreen({
  state,
  watchInput,
  watchError,
  watching,
  copyDelay,
  copyStatus,
  signals,
  busy,
  onWatchInput,
  onDelay,
  onStart,
  onStop,
  onOpenPrompt,
  onCancelPrompt,
  onLevels,
  onConfirm,
  onDismiss,
}: {
  state: PaperState;
  watchInput: string;
  watchError: string | null;
  watching: string | null;
  copyDelay: CopyDelaySeconds;
  copyStatus: string;
  signals: CopySignal[];
  busy: boolean;
  onWatchInput: (v: string) => void;
  onDelay: (d: CopyDelaySeconds) => void;
  onStart: () => void;
  onStop: () => void;
  onOpenPrompt: (s: CopySignal) => void;
  onCancelPrompt: (s: CopySignal) => void;
  onLevels: (s: CopySignal, l: LevelsDraft) => void;
  onConfirm: (s: CopySignal) => void;
  onDismiss: (s: CopySignal) => void;
}) {
  return (
    <>
      <div className="wallet-section">
      <div className="section-title">Copy watch (technical fixture)</div>
      <div className="card hi">
        <p className="fee-line" style={{ marginTop: 0 }}>
          <strong className="alert-strong">Not a recommendation.</strong>{" "}
          Paste any public Solana address to watch its trades as a technical
          fixture / watch tool. Pasting an address does not mean the wallet is
          skilled or worth copying. No preset list. Public addresses only —
          never a seed or private key. Public RPC is demo-grade.
        </p>
        <label className="field" style={{ marginTop: 10 }}>
          <span>Public Solana wallet address</span>
          <input
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste public address…"
            value={watchInput}
            disabled={Boolean(watching)}
            onChange={(e) => onWatchInput(e.target.value)}
          />
        </label>
        {watchError && (
          <div className="error" style={{ marginTop: 8 }}>
            {watchError}
          </div>
        )}
        <div className="field-row" style={{ marginTop: 10 }}>
          <label className="field">
            <span>Delay before quote</span>
            <select
              value={copyDelay}
              onChange={(e) =>
                onDelay(Number(e.target.value) as CopyDelaySeconds)
              }
              disabled={Boolean(watching)}
            >
              <option value={5}>5 seconds</option>
              <option value={15}>15 seconds (default)</option>
              <option value={60}>60 seconds</option>
            </select>
          </label>
        </div>
        <div className="btn-row">
          {!watching ? (
            <button type="button" className="btn btn-primary" onClick={onStart}>
              Follow address
            </button>
          ) : (
            <button type="button" className="btn btn-danger" onClick={onStop}>
              Stop following
            </button>
          )}
        </div>
        <p className="fee-line">
          Status: {copyStatus}. Polls ~every 5s only while following in this
          browser tab — not a 24/7 collector. Assumed slippage{" "}
          {(state.slippageRate * 100).toFixed(0)}%. Jupiter quotes are unsigned
          estimates (no taker / no transaction).
        </p>
      </div>

      <div className="section-title">Signals</div>
      {signals.filter((s) => s.status !== "dismissed").length === 0 && (
        <div className="empty">
          {watching
            ? "Waiting for new successful swaps from this address…"
            : "Follow a public address to see paper copy prompts."}
        </div>
      )}
      {signals
        .filter((s) => s.status !== "dismissed")
        .map((s) => (
          <div className="card" key={s.signature}>
            <div className="brand-row">
              <div>
                <div style={{ fontWeight: 800 }}>
                  {s.direction || "…"} · {s.status}
                </div>
                <div className="small muted">
                  {shortenAddress(s.signature, 6, 6)} · delay {s.delaySeconds}s
                </div>
              </div>
              {s.tokenMeta && (
                <div className="small" style={{ textAlign: "right" }}>
                  ${s.tokenMeta.symbol}
                </div>
              )}
            </div>
            {s.status === "unparsed" && (
              <p className="fee-line">
                Unparsed — {s.reason}. Signature shown; no invented mint/size/fill.
              </p>
            )}
            {s.status === "info" && <p className="fee-line">{s.reason}</p>}
            {s.status === "error" && (
              <p className="fee-line">{s.reason || s.quoteError}</p>
            )}
            {(s.status === "waiting" || s.status === "quoting") && (
              <p className="fee-line">
                Detected · waiting for delay / unsigned Jupiter estimate…
              </p>
            )}
            {s.status === "ready" && s.quote && (
              <>
                <p className="fee-line">
                  Unsigned quote estimate: in {s.quote.inAmount} → out{" "}
                  {s.quote.outAmount}
                  {s.quote.inUsdValue != null
                    ? ` · ~${formatUsd(s.quote.inUsdValue)} in`
                    : ""}
                  . After {(state.slippageRate * 100).toFixed(0)}% assumed
                  slippage, guesstimated out ≈{" "}
                  {Math.floor(
                    slippedTokenAmount(
                      Number(s.quote.outAmount),
                      state.slippageRate
                    )
                  )}{" "}
                  raw. Creator: {s.creatorLabel}. Estimates only — not guaranteed
                  fills. Viewing does not create a position.
                </p>
                {s.direction !== "SELL" && s.costBlockedReason && (
                  <div className="error">{s.costBlockedReason}</div>
                )}
                {s.direction !== "SELL" &&
                  s.costUsd != null &&
                  !canAffordCopyBuy(state, s.costUsd) && (
                    <div className="error">
                      Quote shown, but not enough virtual cash (
                      {formatUsd(s.costUsd)} needed).
                    </div>
                  )}
                {!s.promptOpen ? (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-no"
                      onClick={() => onDismiss(s)}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      className="btn btn-yes"
                      onClick={() => onOpenPrompt(s)}
                      disabled={
                        s.direction !== "SELL" &&
                        (!s.costUsd ||
                          Boolean(s.costBlockedReason) ||
                          !canAffordCopyBuy(state, s.costUsd || 0))
                      }
                    >
                      {s.direction === "SELL"
                        ? "Paper-sell this delayed copy?"
                        : "Paper-buy this delayed copy?"}
                    </button>
                  </div>
                ) : (
                  <div className="prompt">
                    <h3>
                      {s.direction === "SELL"
                        ? "Confirm paper copy sell?"
                        : "Confirm paper copy buy?"}
                    </h3>
                    <p>
                      Delayed {s.delaySeconds}s unsigned Jupiter estimate. Assumed
                      slippage {(state.slippageRate * 100).toFixed(0)}% worsens
                      fill (buys: fewer tokens; sells: less USD out). Meme/copy
                      creator fee 0.300% is recorded on the scoreboard; Jupiter
                      quotes already include on-chain fees — not added again to
                      your copy cost basis. Simulated only.
                    </p>
                    {s.direction !== "SELL" && (
                      <LevelsFields
                        levels={s.levels}
                        onChange={(l) => onLevels(s, l)}
                        entryPriceUsd={s.tokenMeta?.priceUsd ?? null}
                      />
                    )}
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-no"
                        onClick={() => onCancelPrompt(s)}
                        disabled={busy}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        className="btn btn-yes"
                        onClick={() => onConfirm(s)}
                        disabled={busy}
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
    </div>
    </>
  );
}
