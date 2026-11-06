# Paper Copy (meme + copy mode)

Phone-friendly **simulated** Solana paper-trading web app. No wallet connection, no real trades, no on-chain transactions, no deposits.

## What it does

- **Memes**: Lists live Solana meme-style tokens via **DexScreener’s documented public API** (not the official Pump.fun live board). Explicit **Yes / No** before any paper buy.
- **Copy**: Paste **any public Solana wallet address** and follow its trades as a **technical fixture / watch tool — not a recommendation**. No preset list. Session-only polling (~5s) via public RPC while the tab is following; not a 24/7 collector.
- **Slippage**: Assumed excessive slippage (default **10%**, selectable 5/10/15/20% on the Scoreboard). Buys priced up, sells priced down. Fills are guesstimates — not a measured live rate.
- **Stop-loss / take-profit**: Optional USD price levels on paper buys (meme or copy). Checked after periodic mark refreshes. If both would fire on the same refresh, **stop wins** (conservative). Unpriced marks do not auto-close.
- Tracks virtual positions with **0.300%** paper creator fee accounting (Pump.fun documented bonding-curve creator fee; scoreboard-only). Persists in `localStorage` (`paper-copy-v1`, additive migration).

Prices, caps, and Jupiter quotes are **estimates**, not guaranteed fills. Credits are not spendable, transferable, or redeemable.

## Requirements

- Node.js 18+ and npm

## Run locally

```bash
cd /workspace/paper-copy-app
npm install
npm run build
npm start -- -p 3010
```

Or `npm run dev` for development.

## Copy flow (honesty labels)

1. Paste a **public** address only (base58 32-byte pubkey). Seeds / private keys are rejected.
2. Poll `getSignaturesForAddress` + `getTransaction` on `https://api.mainnet-beta.solana.com` via Next.js API routes.
3. After a user-selected delay (5 / 15 / 60s, default 15), fetch an **unsigned** Jupiter quote: `GET https://lite-api.jup.ag/swap/v2/order` **without** `taker`. Any `transaction` field is stripped; never signed.
4. Yes/No prompt — viewing a signal never opens a position.
5. Buy size-matched to copied input; USD from quote/`inUsdValue` or DexScreener SOL price. Unpriced → blocked.
6. Sell signals only offer a paper sell if you already hold that token; sized to **your** paper position.
7. Copy path: Jupiter quotes already include on-chain creator/protocol fees — **do not** add 0.300% again into cost basis; still record estimated 0.300% on the per-meme scoreboard.

## Slippage formulas (paper estimate)

- Meme buy entry cap = `quotedMarketCap * (1 + slippage)`; cash spent = stake + creator fee (slippage does not take extra cash).
- Meme sell: gross from `exitMarketCap * (1 - slippage)`, then creator fee on slipped gross.
- Copy buy: `outTokens * (1 - slippage)`.
- Copy sell: proceeds `* (1 - slippage)`; scoreboard creator fee accrued, **not** subtracted again from user proceeds.

## Stop / take-profit

- Optional USD `stopLossPrice` / `takeProfitPrice` on the buy prompt (meme token screen and copy confirm).
- On mark refresh: stop if live mark ≤ stop; take-profit if live mark ≥ target; both → prefer stop.
- Auto-close uses the level price/cap, then the same slippage + fee accounting as a manual sell. `closeReason`: `stop` | `take_profit` | `manual`.

## Data sources

- DexScreener public API (memes, token meta, SOL/USD)
- Public Solana RPC (demo-grade)
- Jupiter lite unsigned `/swap/v2/order` (no API key, no taker)
- Creator fee reference: https://pump.fun/docs/fees (bonding-curve creator 0.300%, updated 17 Oct 2026)

No Pump.fun developer key. No Helius. No wallet adapter. No real-money mode.

## Notes

- Unpriced tokens cannot be paper-bought or auto-closed.
- Creator identity defaults to **Unknown creator** when unknown.
- Reset paper account keeps the slippage preference.
