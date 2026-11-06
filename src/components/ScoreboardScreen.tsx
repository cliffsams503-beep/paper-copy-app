"use client";

import {
  formatPrice,
  formatSignedUsd,
  formatUsd,
} from "@/lib/format";
import { summarize } from "@/lib/paper";
import type { MemesApiResponse, PaperPosition, PaperState } from "@/lib/types";
import { CREATOR_FEE_RATE, SLIPPAGE_OPTIONS } from "@/lib/types";

function pnlClass(n: number): string {
  if (n > 0) return "gain";
  if (n < 0) return "loss";
  return "";
}

export function ScoreboardScreen({
  state,
  summary,
  coverage,
  feeNote,
  onReset,
  onSlippage,
}: {
  state: PaperState;
  summary: ReturnType<typeof summarize>;
  coverage?: MemesApiResponse["coverage"];
  feeNote?: string;
  onReset: () => void;
  onSlippage: (rate: number) => void;
}) {
  const creators = Object.values(state.creatorFees).sort(
    (a, b) => b.totalFeesUsd - a.totalFeesUsd
  );

  return (
    <>
      <div className="section-title">Wallet scoreboard (simulated)</div>
      <div className="card hi">
        <div className="stat-grid">
          <div className="stat">
            <div className="label">Virtual cash</div>
            <div className="value">{formatUsd(state.cashUsd)}</div>
          </div>
          <div className="stat">
            <div className="label">Est. equity</div>
            <div className="value">{formatUsd(summary.equity)}</div>
          </div>
          <div className="stat">
            <div className="label">Realized G/L</div>
            <div className={`value ${pnlClass(summary.realizedPnl)}`}>
              {formatSignedUsd(summary.realizedPnl)}
            </div>
          </div>
          <div className="stat">
            <div className="label">Unrealized G/L</div>
            <div className={`value ${pnlClass(summary.unrealizedPnl)}`}>
              {formatSignedUsd(summary.unrealizedPnl)}
            </div>
          </div>
          <div className="stat">
            <div className="label">Net G/L</div>
            <div className={`value ${pnlClass(summary.netPnl)}`}>
              {formatSignedUsd(summary.netPnl)}
            </div>
          </div>
          <div className="stat">
            <div className="label">Starting bankroll</div>
            <div className="value">{formatUsd(state.startingBankroll)}</div>
          </div>
        </div>
        <p className="fee-line">
          Net of paper accounting. Not real money. Open positions marked when
          priced; missing data = no invented fill.
        </p>
      </div>

      <div className="section-title">Assumptions</div>
      <div className="card">
        <div className="brand-row">
          <div className="small muted">
            Creator fee rate {(CREATOR_FEE_RATE * 100).toFixed(3)}% (Pump.fun
            documented bonding-curve creator fee)
          </div>
          <div style={{ fontWeight: 800 }}>
            {formatUsd(summary.creatorFeeTotal)}
          </div>
        </div>
        <label className="field" style={{ marginTop: 10 }}>
          <span>
            Assumed slippage (paper estimate; buys priced up, sells priced down;
            fills are guesstimates — not a measured live rate)
          </span>
          <select
            value={state.slippageRate}
            onChange={(e) => onSlippage(Number(e.target.value))}
          >
            {SLIPPAGE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {(r * 100).toFixed(0)}%
              </option>
            ))}
          </select>
        </label>
        <p className="fee-line">
          Assumed slippage: {(state.slippageRate * 100).toFixed(0)}% (paper
          estimate; buys priced up, sells priced down; fills are guesstimates).{" "}
          {feeNote ||
            "Pump.fun documented bonding-curve creator fee 0.300%. Scoreboard-only for copy path (Jupiter already includes on-chain fees in quotes)."}
        </p>
      </div>

      <div className="section-title">Stops &amp; targets</div>
      <div className="card">
        <div className="small muted">
          Open with stop-loss: {summary.withStop} · with take-profit:{" "}
          {summary.withTarget} · auto-closed by stop: {summary.autoClosedStop} ·
          by take-profit: {summary.autoClosedTp}. If both would fire on the same
          periodic mark, stop wins (conservative estimate).
        </div>
        {state.positions
          .filter(
            (p) =>
              p.stopLossPrice ||
              p.takeProfitPrice ||
              p.stopLossMarketCap ||
              p.takeProfitMarketCap
          )
          .map((p: PaperPosition) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 8,
              }}
            >
              <div className="small">
                ${p.symbol} ({p.source})
              </div>
              <div className="small muted" style={{ textAlign: "right" }}>
                SL {p.stopLossPrice ? formatPrice(p.stopLossPrice) : "—"} · TP{" "}
                {p.takeProfitPrice ? formatPrice(p.takeProfitPrice) : "—"}
              </div>
            </div>
          ))}
      </div>

      <div className="section-title">Creator fee earnings (scoreboard only)</div>
      <div className="card">
        <p className="fee-line" style={{ marginTop: 0 }}>
          Per-meme buckets. Copy trades: estimated 0.300% recorded here; not
          subtracted again from copy cost basis (Jupiter quotes include on-chain
          creator/protocol fees).
        </p>
        <div className="divider" />
        {creators.length === 0 && (
          <div className="small muted">No creator fees accrued yet.</div>
        )}
        {creators.map((c) => (
          <div
            key={c.tokenAddress}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                ${c.symbol} · {c.name}
              </div>
              <div className="small muted">{c.creatorLabel}</div>
            </div>
            <div style={{ textAlign: "right", fontWeight: 800 }}>
              {formatUsd(c.totalFeesUsd)}
              <div className="small muted">
                buy {formatUsd(c.buyFeesUsd)} / sell {formatUsd(c.sellFeesUsd)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Data coverage</div>
      <div className="card">
        {coverage ? (
          <div className="small muted">
            Latest list: {coverage.listed} Solana tokens · {coverage.priced}{" "}
            priced · {coverage.unpriced} unpriced. Source: DexScreener public API.
          </div>
        ) : (
          <div className="small muted">Load the meme list to see coverage.</div>
        )}
      </div>

      <button type="button" className="btn btn-ghost" onClick={onReset}>
        Reset paper account
      </button>
    </>
  );
}
