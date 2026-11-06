export type MemeToken = {
  address: string;
  name: string;
  symbol: string;
  iconUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  dexId: string | null;
  url: string | null;
  /** Public creator label if known; otherwise Unknown creator */
  creatorLabel: string;
  priced: boolean;
};

export type MemesApiResponse = {
  source: string;
  disclaimer: string;
  fetchedAt: string;
  tokens: MemeToken[];
  coverage: {
    listed: number;
    priced: number;
    unpriced: number;
  };
  feeNote: string;
};

export type PositionSource = "meme" | "copy";

export type CloseReason = "manual" | "stop" | "take_profit";

export type PaperPosition = {
  id: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  iconUrl: string | null;
  entryMarketCap: number;
  /** Entry token price in USD when known (for SL/TP in price units). */
  entryPriceUsd: number | null;
  stakeUsd: number;
  buyFeeUsd: number;
  costBasis: number;
  openedAt: string;
  creatorLabel: string;
  /** Last known market cap used for marks; may be stale if currently unpriced */
  lastMarketCap: number | null;
  lastPriceUsd: number | null;
  lastMarkedAt: string | null;
  unpriced: boolean;
  source: PositionSource;
  /** Assumed slippage applied at open (meme entry cap / copy token size). */
  slippageRateAtOpen: number;
  /** Optional stop-loss in USD token price. */
  stopLossPrice: number | null;
  /** Optional take-profit in USD token price. */
  takeProfitPrice: number | null;
  /** Optional stop as market-cap level when price unit unavailable. */
  stopLossMarketCap: number | null;
  /** Optional take-profit as market-cap level when price unit unavailable. */
  takeProfitMarketCap: number | null;
  /** Copy-mode fields */
  tokenAmount: number | null;
  tokenDecimals: number | null;
  watchedAddress: string | null;
  copySignature: string | null;
  copyDelaySeconds: number | null;
  quotedOutRaw: string | null;
  slippedOutRaw: string | null;
};

export type RealizedTrade = {
  id: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  entryMarketCap: number;
  exitMarketCap: number;
  stakeUsd: number;
  buyFeeUsd: number;
  sellFeeUsd: number;
  costBasis: number;
  grossProceeds: number;
  netProceeds: number;
  realizedPnl: number;
  openedAt: string;
  closedAt: string;
  creatorLabel: string;
  source: PositionSource;
  closeReason: CloseReason;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  exitPriceUsd: number | null;
};

export type CreatorFeeBucket = {
  tokenAddress: string;
  name: string;
  symbol: string;
  creatorLabel: string;
  buyFeesUsd: number;
  sellFeesUsd: number;
  totalFeesUsd: number;
};

export type PaperState = {
  version: 1;
  startingBankroll: number;
  cashUsd: number;
  defaultStakeUsd: number;
  creatorFeeRate: number;
  /** Assumed excessive slippage (paper estimate). Default 0.10. */
  slippageRate: number;
  positions: PaperPosition[];
  realized: RealizedTrade[];
  creatorFees: Record<string, CreatorFeeBucket>;
};

export type Screen = "list" | "token" | "positions" | "scoreboard" | "copy";

export type CopyDelaySeconds = 5 | 15 | 60;

export type ParsedSwap = {
  parseOk: boolean;
  signature: string;
  err: unknown;
  direction: "BUY" | "SELL" | "TOKEN_SWAP" | null;
  inMint: string | null;
  inAmount: string | null;
  outMint: string | null;
  outAmount: string | null;
  programs: string[];
  pumpEvents: Array<{
    mint: string;
    solAmount: string;
    tokenAmount: string;
    isBuy: boolean;
    user: string;
    creator: string | null;
    creatorFee: string | null;
  }>;
  creatorLabel: string;
  reason?: string;
};

export type UnsignedQuote = {
  ok: boolean;
  estimateOnly: true;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  inUsdValue: number | null;
  outUsdValue: number | null;
  priceImpact: number | null;
  router: string | null;
  feeBps: number | null;
  routes: string[];
  transactionIsNull: boolean;
  error?: string;
};

export const CREATOR_FEE_RATE = 0.003;
export const DEFAULT_STAKE_USD = 100;
export const STARTING_BANKROLL_USD = 10_000;
export const DEFAULT_SLIPPAGE_RATE = 0.1;
export const SLIPPAGE_OPTIONS = [0.05, 0.1, 0.15, 0.2] as const;
export const STORAGE_KEY = "paper-copy-v1";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const SOL_MINT_NATIVE = "11111111111111111111111111111111";
