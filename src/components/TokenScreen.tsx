"use client";

import {
  formatMarketCap,
  formatPrice,
  formatUsd,
} from "@/lib/format";
import { canAffordBuy, previewMemeBuyFill } from "@/lib/paper";
import type { MemeToken, PaperState } from "@/lib/types";
import { CREATOR_FEE_RATE, DEFAULT_STAKE_USD } from "@/lib/types";
import {
  LevelsDraft,
  LevelsFields,
} from "./LevelsFields";

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

export function TokenScreen({
  token,
  state,
  promptOpen,
  busy,
  levels,
  onLevels,
  onBack,
  onAskBuy,
  onCancelBuy,
  onConfirmBuy,
}: {
  token: MemeToken;
  state: PaperState;
  promptOpen: boolean;
  busy: boolean;
  levels: LevelsDraft;
  onLevels: (l: LevelsDraft) => void;
  onBack: () => void;
  onAskBuy: () => void;
  onCancelBuy: () => void;
  onConfirmBuy: () => void;
}) {
  const preview =
    token.marketCap && token.marketCap > 0
      ? previewMemeBuyFill(
          token.marketCap,
          DEFAULT_STAKE_USD,
          state.creatorFeeRate,
          state.slippageRate
        )
      : null;
  const afford = canAffordBuy(state);

  return (
    <>
      <button type="button" className="back" onClick={onBack}>
        ← Back to list
      </button>
      <div className="card hi">
        <div className="token-hero">
          <Avatar src={token.iconUrl} symbol={token.symbol} />
          <div>
            <h2>{token.name}</h2>
            <div className="sym muted">${token.symbol}</div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="label">Price (est.)</div>
            <div className="value">
              {token.priced ? formatPrice(token.priceUsd) : "Unpriced"}
            </div>
          </div>
          <div className="stat">
            <div className="label">Market cap (est.)</div>
            <div className="value">
              {token.priced ? formatMarketCap(token.marketCap) : "Unpriced"}
            </div>
          </div>
        </div>
        <p className="fee-line">
          Creator: {token.creatorLabel}. Paper creator fee rate{" "}
          {(CREATOR_FEE_RATE * 100).toFixed(3)}% (Pump.fun documented bonding-curve
          creator fee). Assumed slippage{" "}
          {(state.slippageRate * 100).toFixed(0)}% (paper estimate). Viewing this
          token does not create a position.
        </p>
      </div>

      {!token.priced && (
        <div className="card">
          <div className="empty" style={{ padding: 12 }}>
            This token is <strong>unpriced</strong> (missing price or market cap).
            Paper buy is disabled — we won’t invent a number.
          </div>
        </div>
      )}

      {token.priced && !promptOpen && (
        <>
          <div className="card">
            <LevelsFields
              levels={levels}
              onChange={onLevels}
              entryPriceUsd={token.priceUsd}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAskBuy}
            disabled={!afford}
          >
            {afford
              ? `Paper buy · $${DEFAULT_STAKE_USD} virtual`
              : "Not enough virtual cash"}
          </button>
        </>
      )}

      {token.priced && promptOpen && preview && (
        <div className="prompt" role="dialog" aria-label="Confirm paper buy">
          <h3>Confirm paper buy?</h3>
          <p className="big">
            Paper-buy {token.symbol}? Quoted mid cap{" "}
            {formatMarketCap(preview.quotedMarketCap)}; guesstimated fill cap{" "}
            {formatMarketCap(preview.slippedEntryMarketCap)} after{" "}
            {(preview.slippageRate * 100).toFixed(0)}% assumed slippage (buys
            priced up).
          </p>
          <p>
            Uses {formatUsd(DEFAULT_STAKE_USD)} virtual. Creator fee{" "}
            {(CREATOR_FEE_RATE * 100).toFixed(3)}% ({formatUsd(preview.fee)}) —
            Pump.fun documented bonding-curve creator fee. Cost basis{" "}
            {formatUsd(preview.cost)}. Slippage worsens fill, not extra cash.
            Simulated only.
          </p>
          <LevelsFields
            levels={levels}
            onChange={onLevels}
            entryPriceUsd={
              token.priceUsd
                ? token.priceUsd * (1 + state.slippageRate)
                : token.priceUsd
            }
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-no"
              onClick={onCancelBuy}
              disabled={busy}
            >
              No
            </button>
            <button
              type="button"
              className="btn btn-yes"
              onClick={onConfirmBuy}
              disabled={busy || !afford}
            >
              Yes, paper buy
            </button>
          </div>
        </div>
      )}
    </>
  );
}
