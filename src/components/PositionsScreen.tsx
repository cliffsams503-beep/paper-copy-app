"use client";

import {
  formatMarketCap,
  formatPrice,
  formatSignedUsd,
  formatUsd,
} from "@/lib/format";
import {
  markToMarketValue,
  previewMemeSellFill,
} from "@/lib/paper";
import type { MemeToken, PaperState } from "@/lib/types";

function Avatar({
  src,
  symbol,
}: {
  src: string | null;
  symbol: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={src} alt="" />;
  }
  return (
    <div className="avatar fallback" aria-hidden>
      {(symbol || "?").slice(0, 3)}
    </div>
  );
}

function pnlClass(n: number): string {
  if (n > 0) return "gain";
  if (n < 0) return "loss";
  return "";
}

export function PositionsScreen({
  state,
  tokenMap,
  sellPromptId,
  busy,
  onAskSell,
  onCancelSell,
  onConfirmSell,
  onBrowse,
}: {
  state: PaperState;
  tokenMap: Map<string, MemeToken>;
  sellPromptId: string | null;
  busy: boolean;
  onAskSell: (id: string) => void;
  onCancelSell: () => void;
  onConfirmSell: (id: string) => void;
  onBrowse: () => void;
}) {
  if (state.positions.length === 0 && state.realized.length === 0) {
    return (
      <div className="empty">
        No paper positions yet.
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={onBrowse}>
            Browse live memes
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section-title">Holdings (simulated)</div>
      {state.positions.length === 0 && (
        <div className="empty">No open positions.</div>
      )}
      {state.positions.map((p) => {
        const live = tokenMap.get(p.tokenAddress);
        const liveCap =
          live?.marketCap && live.marketCap > 0 ? live.marketCap : null;
        const livePrice =
          live?.priceUsd && live.priceUsd > 0 ? live.priceUsd : null;
        const markCap =
          liveCap ??
          (p.lastMarketCap && p.lastMarketCap > 0 ? p.lastMarketCap : null);
        const markPrice =
          livePrice ??
          (p.lastPriceUsd && p.lastPriceUsd > 0 ? p.lastPriceUsd : null);
        const unpriced =
          p.source === "copy" ? !markPrice && !markCap : !liveCap;
        let mark: number | null = null;
        if (p.source === "copy" && p.tokenAmount && markPrice && markPrice > 0) {
          mark = p.tokenAmount * markPrice;
        } else if (markCap && markCap > 0) {
          mark = markToMarketValue(p.stakeUsd, p.entryMarketCap, markCap);
        }
        const unreal =
          mark !== null ? mark - p.costBasis : p.stakeUsd - p.costBasis;
        const sellPreview =
          p.source === "meme" && markCap
            ? previewMemeSellFill(
                p,
                markCap,
                state.creatorFeeRate,
                state.slippageRate
              )
            : null;

        return (
          <div className="card pos" key={p.id}>
            <div className="pos-head">
              <Avatar src={p.iconUrl} symbol={p.symbol} />
              <div className="titles">
                <div className="name" style={{ fontWeight: 800 }}>
                  {p.name}{" "}
                  <span className="badge" style={{ marginLeft: 4 }}>
                    {p.source}
                  </span>
                </div>
                <div className="small muted">
                  ${p.symbol} · entry{" "}
                  {p.source === "meme"
                    ? formatMarketCap(p.entryMarketCap)
                    : formatUsd(p.costBasis)}
                  {p.entryPriceUsd ? ` · ${formatPrice(p.entryPriceUsd)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  className={`value ${pnlClass(unreal)}`}
                  style={{ fontWeight: 800 }}
                >
                  {formatSignedUsd(unreal)}
                </div>
                <div className="small muted">
                  {unpriced ? "stale/unpriced" : "marked"}
                </div>
              </div>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <div className="label">Mark value</div>
                <div className="value">
                  {mark !== null ? formatUsd(mark) : "—"}
                </div>
              </div>
              <div className="stat">
                <div className="label">Cost basis</div>
                <div className="value">{formatUsd(p.costBasis)}</div>
              </div>
            </div>
            <p className="fee-line">
              SL:{" "}
              {p.stopLossPrice
                ? formatPrice(p.stopLossPrice)
                : p.stopLossMarketCap
                  ? `mcap ${formatMarketCap(p.stopLossMarketCap)}`
                  : "none"}{" "}
              · TP:{" "}
              {p.takeProfitPrice
                ? formatPrice(p.takeProfitPrice)
                : p.takeProfitMarketCap
                  ? `mcap ${formatMarketCap(p.takeProfitMarketCap)}`
                  : "none"}
              . Slip at open {(p.slippageRateAtOpen * 100).toFixed(0)}%. Buy fee
              bucket {formatUsd(p.buyFeeUsd)} → {p.creatorLabel}.
            </p>
            {sellPromptId === p.id ? (
              <div className="prompt">
                <h3>Confirm paper sell?</h3>
                <p>
                  Sell {p.symbol} at estimated{" "}
                  {markCap
                    ? formatMarketCap(markCap)
                    : markPrice
                      ? formatPrice(markPrice)
                      : "unavailable"}
                  ? Assumed slippage {(state.slippageRate * 100).toFixed(0)}%
                  prices sells down
                  {sellPreview
                    ? ` → guesstimated exit cap ${formatMarketCap(sellPreview.slippedExitMarketCap)}, net ~${formatUsd(sellPreview.netProceeds)}`
                    : ""}
                  . Creator fee accounting applies per mode. Simulated only.
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-no"
                    onClick={onCancelSell}
                    disabled={busy}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => onConfirmSell(p.id)}
                    disabled={busy || unpriced}
                  >
                    Yes, paper sell
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onAskSell(p.id)}
                disabled={unpriced}
              >
                {unpriced ? "Unpriced — sell blocked" : "Paper sell…"}
              </button>
            )}
          </div>
        );
      })}

      {state.realized.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>
            Realized (closed)
          </div>
          {state.realized.slice(0, 20).map((t) => (
            <div className="card" key={t.id}>
              <div className="brand-row">
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {t.name} · ${t.symbol}{" "}
                    <span className="badge">{t.closeReason}</span>
                  </div>
                  <div className="small muted">
                    {formatMarketCap(t.entryMarketCap)} →{" "}
                    {formatMarketCap(t.exitMarketCap)} · {t.source}
                  </div>
                </div>
                <div
                  className={pnlClass(t.realizedPnl)}
                  style={{ fontWeight: 800 }}
                >
                  {formatSignedUsd(t.realizedPnl)}
                </div>
              </div>
              <div className="fee-line">
                Fees bucket: buy {formatUsd(t.buyFeeUsd)} + sell{" "}
                {formatUsd(t.sellFeeUsd)} → {t.creatorLabel}
                {t.closeReason === "stop"
                  ? " · closed by stop-loss (estimate; periodic marks)"
                  : t.closeReason === "take_profit"
                    ? " · closed by take-profit (estimate; periodic marks)"
                    : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
