import {
  CREATOR_FEE_RATE,
  DEFAULT_SLIPPAGE_RATE,
  DEFAULT_STAKE_USD,
  CloseReason,
  CreatorFeeBucket,
  PaperPosition,
  PaperState,
  PositionSource,
  RealizedTrade,
  STARTING_BANKROLL_USD,
  STORAGE_KEY,
} from "./types";

export function createInitialState(): PaperState {
  return {
    version: 1,
    startingBankroll: STARTING_BANKROLL_USD,
    cashUsd: STARTING_BANKROLL_USD,
    defaultStakeUsd: DEFAULT_STAKE_USD,
    creatorFeeRate: CREATOR_FEE_RATE,
    slippageRate: DEFAULT_SLIPPAGE_RATE,
    positions: [],
    realized: [],
    creatorFees: {},
  };
}

function migratePosition(p: Partial<PaperPosition> & PaperPosition): PaperPosition {
  return {
    ...p,
    entryPriceUsd: p.entryPriceUsd ?? p.lastPriceUsd ?? null,
    source: p.source ?? "meme",
    slippageRateAtOpen: p.slippageRateAtOpen ?? DEFAULT_SLIPPAGE_RATE,
    stopLossPrice: p.stopLossPrice ?? null,
    takeProfitPrice: p.takeProfitPrice ?? null,
    stopLossMarketCap: p.stopLossMarketCap ?? null,
    takeProfitMarketCap: p.takeProfitMarketCap ?? null,
    tokenAmount: p.tokenAmount ?? null,
    tokenDecimals: p.tokenDecimals ?? null,
    watchedAddress: p.watchedAddress ?? null,
    copySignature: p.copySignature ?? null,
    copyDelaySeconds: p.copyDelaySeconds ?? null,
    quotedOutRaw: p.quotedOutRaw ?? null,
    slippedOutRaw: p.slippedOutRaw ?? null,
  };
}

function migrateRealized(
  t: Partial<RealizedTrade> & RealizedTrade
): RealizedTrade {
  return {
    ...t,
    source: t.source ?? "meme",
    closeReason: t.closeReason ?? "manual",
    stopLossPrice: t.stopLossPrice ?? null,
    takeProfitPrice: t.takeProfitPrice ?? null,
    exitPriceUsd: t.exitPriceUsd ?? null,
  };
}

export function loadState(): PaperState {
  if (typeof window === "undefined") return createInitialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<PaperState>;
    if (parsed?.version !== 1) return createInitialState();
    const base = createInitialState();
    return {
      ...base,
      ...parsed,
      version: 1,
      creatorFeeRate: parsed.creatorFeeRate ?? CREATOR_FEE_RATE,
      slippageRate:
        typeof parsed.slippageRate === "number" && parsed.slippageRate >= 0
          ? parsed.slippageRate
          : DEFAULT_SLIPPAGE_RATE,
      positions: (parsed.positions ?? []).map((p) =>
        migratePosition(p as PaperPosition)
      ),
      realized: (parsed.realized ?? []).map((t) =>
        migrateRealized(t as RealizedTrade)
      ),
      creatorFees: parsed.creatorFees ?? {},
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state: PaperState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureCreatorBucket(
  state: PaperState,
  tokenAddress: string,
  name: string,
  symbol: string,
  creatorLabel: string
): CreatorFeeBucket {
  const existing = state.creatorFees[tokenAddress];
  if (existing) return existing;
  const bucket: CreatorFeeBucket = {
    tokenAddress,
    name,
    symbol,
    creatorLabel,
    buyFeesUsd: 0,
    sellFeesUsd: 0,
    totalFeesUsd: 0,
  };
  state.creatorFees[tokenAddress] = bucket;
  return bucket;
}

export function markToMarketValue(
  stakeUsd: number,
  entryMarketCap: number,
  currentMarketCap: number
): number {
  if (entryMarketCap <= 0) return stakeUsd;
  return stakeUsd * (currentMarketCap / entryMarketCap);
}

/** Widen buy: worse fill = higher entry cap → fewer units for same stake. */
export function slippedBuyMarketCap(
  quotedMarketCap: number,
  slippageRate: number
): number {
  return quotedMarketCap * (1 + slippageRate);
}

/** Widen sell: worse fill = lower exit cap. */
export function slippedSellMarketCap(
  quotedExitMarketCap: number,
  slippageRate: number
): number {
  return quotedExitMarketCap * (1 - slippageRate);
}

/** Reduce quoted output tokens by slippage percent (worse fill). */
export function slippedTokenAmount(
  quotedAmount: number,
  slippageRate: number
): number {
  return quotedAmount * (1 - slippageRate);
}

export function canAffordBuy(
  state: PaperState,
  stakeUsd = state.defaultStakeUsd
): boolean {
  const fee = stakeUsd * state.creatorFeeRate;
  return state.cashUsd >= stakeUsd + fee;
}

export function canAffordCopyBuy(state: PaperState, costUsd: number): boolean {
  return costUsd > 0 && state.cashUsd >= costUsd;
}

export type LevelsInput = {
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  stopLossMarketCap?: number | null;
  takeProfitMarketCap?: number | null;
};

function normalizeLevels(levels?: LevelsInput) {
  return {
    stopLossPrice:
      levels?.stopLossPrice && levels.stopLossPrice > 0
        ? levels.stopLossPrice
        : null,
    takeProfitPrice:
      levels?.takeProfitPrice && levels.takeProfitPrice > 0
        ? levels.takeProfitPrice
        : null,
    stopLossMarketCap:
      levels?.stopLossMarketCap && levels.stopLossMarketCap > 0
        ? levels.stopLossMarketCap
        : null,
    takeProfitMarketCap:
      levels?.takeProfitMarketCap && levels.takeProfitMarketCap > 0
        ? levels.takeProfitMarketCap
        : null,
  };
}

export function openPaperBuy(
  state: PaperState,
  args: {
    tokenAddress: string;
    name: string;
    symbol: string;
    iconUrl: string | null;
    marketCap: number;
    priceUsd: number | null;
    creatorLabel: string;
    stakeUsd?: number;
  } & LevelsInput
): { ok: true; state: PaperState; position: PaperPosition } | { ok: false; reason: string } {
  if (!(args.marketCap > 0)) {
    return { ok: false, reason: "Token is unpriced — paper buy blocked." };
  }
  const stakeUsd = args.stakeUsd ?? state.defaultStakeUsd;
  const buyFeeUsd = stakeUsd * state.creatorFeeRate;
  const costBasis = stakeUsd + buyFeeUsd;
  if (state.cashUsd < costBasis) {
    return { ok: false, reason: "Not enough virtual cash for this paper buy." };
  }

  const entryMarketCap = slippedBuyMarketCap(
    args.marketCap,
    state.slippageRate
  );
  // Entry price also worsened by the same slippage assumption for SL/TP consistency.
  const entryPriceUsd =
    args.priceUsd && args.priceUsd > 0
      ? args.priceUsd * (1 + state.slippageRate)
      : null;

  const levels = normalizeLevels(args);

  const position: PaperPosition = {
    id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tokenAddress: args.tokenAddress,
    name: args.name,
    symbol: args.symbol,
    iconUrl: args.iconUrl,
    entryMarketCap,
    entryPriceUsd,
    stakeUsd,
    buyFeeUsd,
    costBasis,
    openedAt: new Date().toISOString(),
    creatorLabel: args.creatorLabel || "Unknown creator",
    lastMarketCap: args.marketCap,
    lastPriceUsd: args.priceUsd,
    lastMarkedAt: new Date().toISOString(),
    unpriced: false,
    source: "meme",
    slippageRateAtOpen: state.slippageRate,
    ...levels,
    tokenAmount: null,
    tokenDecimals: null,
    watchedAddress: null,
    copySignature: null,
    copyDelaySeconds: null,
    quotedOutRaw: null,
    slippedOutRaw: null,
  };

  const next: PaperState = {
    ...state,
    cashUsd: state.cashUsd - costBasis,
    positions: [position, ...state.positions],
    creatorFees: { ...state.creatorFees },
  };
  const bucket = ensureCreatorBucket(
    next,
    args.tokenAddress,
    args.name,
    args.symbol,
    position.creatorLabel
  );
  bucket.buyFeesUsd += buyFeeUsd;
  bucket.totalFeesUsd += buyFeeUsd;
  bucket.name = args.name;
  bucket.symbol = args.symbol;

  return { ok: true, state: next, position };
}

/**
 * Copy-mode paper buy.
 * Jupiter quotes already include on-chain creator/protocol fees — do NOT add
 * creator fee into the user's cost basis. Still record estimated creator fee
 * on the scoreboard bucket and label it clearly.
 */
export function openCopyPaperBuy(
  state: PaperState,
  args: {
    tokenAddress: string;
    name: string;
    symbol: string;
    iconUrl: string | null;
    priceUsd: number | null;
    marketCap: number | null;
    creatorLabel: string;
    costUsd: number;
    quotedOutRaw: string;
    tokenDecimals: number;
    watchedAddress: string;
    copySignature: string;
    copyDelaySeconds: number;
  } & LevelsInput
): { ok: true; state: PaperState; position: PaperPosition } | { ok: false; reason: string } {
  if (!(args.costUsd > 0)) {
    return { ok: false, reason: "Copy buy is unpriced — paper buy blocked." };
  }
  if (!canAffordCopyBuy(state, args.costUsd)) {
    return { ok: false, reason: "Not enough virtual cash for this paper copy buy." };
  }
  const quotedOut = Number(args.quotedOutRaw);
  if (!(quotedOut > 0)) {
    return { ok: false, reason: "Quote missing output — paper buy blocked." };
  }

  const slippedOut = slippedTokenAmount(quotedOut, state.slippageRate);
  const tokenAmount = slippedOut / 10 ** args.tokenDecimals;
  // Estimated creator fee for scoreboard only — not added to cost basis.
  const buyFeeUsd = args.costUsd * state.creatorFeeRate;
  const costBasis = args.costUsd;
  const levels = normalizeLevels(args);

  const entryPriceUsd =
    args.priceUsd && args.priceUsd > 0
      ? args.priceUsd * (1 + state.slippageRate)
      : tokenAmount > 0
        ? (args.costUsd / tokenAmount) // implied from slipped fill
        : null;

  const entryMarketCap =
    args.marketCap && args.marketCap > 0
      ? slippedBuyMarketCap(args.marketCap, state.slippageRate)
      : entryPriceUsd && entryPriceUsd > 0
        ? entryPriceUsd // placeholder scale; MTM for copy prefers token*price
        : 1;

  const position: PaperPosition = {
    id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tokenAddress: args.tokenAddress,
    name: args.name,
    symbol: args.symbol,
    iconUrl: args.iconUrl,
    entryMarketCap,
    entryPriceUsd,
    stakeUsd: args.costUsd,
    buyFeeUsd,
    costBasis,
    openedAt: new Date().toISOString(),
    creatorLabel: args.creatorLabel || "Unknown creator",
    lastMarketCap: args.marketCap,
    lastPriceUsd: args.priceUsd,
    lastMarkedAt: new Date().toISOString(),
    unpriced: !(args.priceUsd && args.priceUsd > 0) && !(args.marketCap && args.marketCap > 0),
    source: "copy",
    slippageRateAtOpen: state.slippageRate,
    ...levels,
    tokenAmount,
    tokenDecimals: args.tokenDecimals,
    watchedAddress: args.watchedAddress,
    copySignature: args.copySignature,
    copyDelaySeconds: args.copyDelaySeconds,
    quotedOutRaw: args.quotedOutRaw,
    slippedOutRaw: Math.floor(slippedOut).toString(),
  };

  const next: PaperState = {
    ...state,
    cashUsd: state.cashUsd - costBasis,
    positions: [position, ...state.positions],
    creatorFees: { ...state.creatorFees },
  };
  const bucket = ensureCreatorBucket(
    next,
    args.tokenAddress,
    args.name,
    args.symbol,
    position.creatorLabel
  );
  bucket.buyFeesUsd += buyFeeUsd;
  bucket.totalFeesUsd += buyFeeUsd;
  bucket.name = args.name;
  bucket.symbol = args.symbol;

  return { ok: true, state: next, position };
}

function positionMarkValue(p: PaperPosition): {
  mark: number;
  usedStale: boolean;
} {
  if (
    p.source === "copy" &&
    p.tokenAmount &&
    p.tokenAmount > 0 &&
    p.lastPriceUsd &&
    p.lastPriceUsd > 0 &&
    !p.unpriced
  ) {
    return { mark: p.tokenAmount * p.lastPriceUsd, usedStale: false };
  }
  const m1 = p.lastMarketCap;
  if (m1 && m1 > 0 && !p.unpriced) {
    return {
      mark: markToMarketValue(p.stakeUsd, p.entryMarketCap, m1),
      usedStale: false,
    };
  }
  if (p.lastMarketCap && p.lastMarketCap > 0) {
    return {
      mark: markToMarketValue(p.stakeUsd, p.entryMarketCap, p.lastMarketCap),
      usedStale: true,
    };
  }
  if (
    p.source === "copy" &&
    p.tokenAmount &&
    p.tokenAmount > 0 &&
    p.lastPriceUsd &&
    p.lastPriceUsd > 0
  ) {
    return { mark: p.tokenAmount * p.lastPriceUsd, usedStale: true };
  }
  return { mark: p.stakeUsd, usedStale: true };
}

/**
 * Close a paper position.
 * Meme: apply sell slippage to exit cap, then creator fee on slipped gross (subtracted from user).
 * Copy: apply sell slippage to proceeds; accrue estimated creator fee to scoreboard only
 *       (do not subtract again — Jupiter path already priced fees in).
 */
export function closePaperSell(
  state: PaperState,
  positionId: string,
  exitMarketCap: number,
  opts?: {
    closeReason?: CloseReason;
    exitPriceUsd?: number | null;
    /** For copy closes without a fresh Jupiter quote: USD proceeds before slip. */
    copyGrossProceedsUsd?: number | null;
  }
): { ok: true; state: PaperState; trade: RealizedTrade } | { ok: false; reason: string } {
  const position = state.positions.find((p) => p.id === positionId);
  if (!position) return { ok: false, reason: "Position not found." };

  const closeReason = opts?.closeReason ?? "manual";
  const exitPriceUsd = opts?.exitPriceUsd ?? null;
  const slip = state.slippageRate;

  let grossProceeds: number;
  let effectiveExitCap: number;
  let sellFeeUsd: number;
  let netProceeds: number;

  if (position.source === "copy") {
    const preSlip =
      opts?.copyGrossProceedsUsd && opts.copyGrossProceedsUsd > 0
        ? opts.copyGrossProceedsUsd
        : exitPriceUsd &&
            exitPriceUsd > 0 &&
            position.tokenAmount &&
            position.tokenAmount > 0
          ? position.tokenAmount * exitPriceUsd
          : exitMarketCap > 0
            ? markToMarketValue(
                position.stakeUsd,
                position.entryMarketCap,
                exitMarketCap
              )
            : 0;
    if (!(preSlip > 0)) {
      return { ok: false, reason: "Token is unpriced — paper sell blocked." };
    }
    grossProceeds = preSlip * (1 - slip);
    // Scoreboard-only estimated creator fee; do not double-count in user proceeds.
    sellFeeUsd = grossProceeds * state.creatorFeeRate;
    netProceeds = grossProceeds;
    effectiveExitCap =
      exitMarketCap > 0
        ? slippedSellMarketCap(exitMarketCap, slip)
        : position.entryMarketCap *
          (grossProceeds / Math.max(position.stakeUsd, 1e-9));
  } else {
    if (!(exitMarketCap > 0)) {
      return { ok: false, reason: "Token is unpriced — paper sell blocked." };
    }
    effectiveExitCap = slippedSellMarketCap(exitMarketCap, slip);
    grossProceeds = markToMarketValue(
      position.stakeUsd,
      position.entryMarketCap,
      effectiveExitCap
    );
    sellFeeUsd = grossProceeds * state.creatorFeeRate;
    netProceeds = grossProceeds - sellFeeUsd;
  }

  const realizedPnl = netProceeds - position.costBasis;

  const trade: RealizedTrade = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tokenAddress: position.tokenAddress,
    name: position.name,
    symbol: position.symbol,
    entryMarketCap: position.entryMarketCap,
    exitMarketCap: effectiveExitCap,
    stakeUsd: position.stakeUsd,
    buyFeeUsd: position.buyFeeUsd,
    sellFeeUsd,
    costBasis: position.costBasis,
    grossProceeds,
    netProceeds,
    realizedPnl,
    openedAt: position.openedAt,
    closedAt: new Date().toISOString(),
    creatorLabel: position.creatorLabel,
    source: position.source,
    closeReason,
    stopLossPrice: position.stopLossPrice,
    takeProfitPrice: position.takeProfitPrice,
    exitPriceUsd:
      exitPriceUsd && exitPriceUsd > 0
        ? exitPriceUsd * (position.source === "meme" ? 1 : 1 - slip)
        : null,
  };

  const next: PaperState = {
    ...state,
    cashUsd: state.cashUsd + netProceeds,
    positions: state.positions.filter((p) => p.id !== positionId),
    realized: [trade, ...state.realized],
    creatorFees: { ...state.creatorFees },
  };
  const bucket = ensureCreatorBucket(
    next,
    position.tokenAddress,
    position.name,
    position.symbol,
    position.creatorLabel
  );
  bucket.sellFeesUsd += sellFeeUsd;
  bucket.totalFeesUsd += sellFeeUsd;

  return { ok: true, state: next, trade };
}

export function refreshPositionMarks(
  state: PaperState,
  quotes: Record<
    string,
    { marketCap: number | null; priceUsd: number | null }
  >
): PaperState {
  const positions = state.positions.map((p) => {
    const q = quotes[p.tokenAddress];
    if (!q) return p;
    const hasCap =
      q.marketCap !== null && q.marketCap !== undefined && q.marketCap > 0;
    const hasPrice =
      q.priceUsd !== null && q.priceUsd !== undefined && q.priceUsd > 0;
    const unpriced =
      p.source === "copy" ? !hasPrice && !hasCap : !hasCap;
    return {
      ...p,
      lastMarketCap: hasCap ? q.marketCap : p.lastMarketCap,
      lastPriceUsd: hasPrice ? q.priceUsd : p.lastPriceUsd,
      lastMarkedAt: new Date().toISOString(),
      unpriced,
    };
  });
  return { ...state, positions };
}

/**
 * After marks refresh: auto-close positions that hit stop or take-profit.
 * If both would trigger on the same refresh, prefer stop (conservative).
 * Unpriced / missing live mark → leave open.
 */
export function applyStopTakeProfit(
  state: PaperState
): { state: PaperState; closed: RealizedTrade[] } {
  let current = state;
  const closed: RealizedTrade[] = [];

  // Snapshot ids — closes mutate the list
  const ids = current.positions.map((p) => p.id);
  for (const id of ids) {
    const p = current.positions.find((x) => x.id === id);
    if (!p || p.unpriced) continue;

    const hasPriceMark = p.lastPriceUsd !== null && p.lastPriceUsd > 0;
    const hasCapMark = p.lastMarketCap !== null && p.lastMarketCap > 0;

    let hitStop = false;
    let hitTarget = false;
    let stopExitPrice: number | null = null;
    let targetExitPrice: number | null = null;
    let stopExitCap: number | null = null;
    let targetExitCap: number | null = null;

    if (hasPriceMark && p.stopLossPrice && p.stopLossPrice > 0) {
      if ((p.lastPriceUsd as number) <= p.stopLossPrice) {
        hitStop = true;
        stopExitPrice = p.stopLossPrice;
        if (p.entryPriceUsd && p.entryPriceUsd > 0) {
          stopExitCap =
            p.entryMarketCap * (p.stopLossPrice / p.entryPriceUsd);
        } else if (hasCapMark) {
          stopExitCap = p.lastMarketCap;
        }
      }
    } else if (hasCapMark && p.stopLossMarketCap && p.stopLossMarketCap > 0) {
      if ((p.lastMarketCap as number) <= p.stopLossMarketCap) {
        hitStop = true;
        stopExitCap = p.stopLossMarketCap;
      }
    }

    if (hasPriceMark && p.takeProfitPrice && p.takeProfitPrice > 0) {
      if ((p.lastPriceUsd as number) >= p.takeProfitPrice) {
        hitTarget = true;
        targetExitPrice = p.takeProfitPrice;
        if (p.entryPriceUsd && p.entryPriceUsd > 0) {
          targetExitCap =
            p.entryMarketCap * (p.takeProfitPrice / p.entryPriceUsd);
        } else if (hasCapMark) {
          targetExitCap = p.lastMarketCap;
        }
      }
    } else if (
      hasCapMark &&
      p.takeProfitMarketCap &&
      p.takeProfitMarketCap > 0
    ) {
      if ((p.lastMarketCap as number) >= p.takeProfitMarketCap) {
        hitTarget = true;
        targetExitCap = p.takeProfitMarketCap;
      }
    }

    if (!hitStop && !hitTarget) continue;

    // Conservative: if both fire on same periodic mark, prefer stop.
    const useStop = hitStop;
    const reason: CloseReason = useStop ? "stop" : "take_profit";
    const exitCap = useStop
      ? stopExitCap
      : targetExitCap;
    const exitPrice = useStop ? stopExitPrice : targetExitPrice;

    if (p.source === "meme") {
      if (!(exitCap && exitCap > 0)) continue;
      const result = closePaperSell(current, p.id, exitCap, {
        closeReason: reason,
        exitPriceUsd: exitPrice,
      });
      if (result.ok) {
        current = result.state;
        closed.push(result.trade);
      }
    } else {
      // Copy: close at level price * token amount (no invented Jupiter path).
      if (exitPrice && exitPrice > 0 && p.tokenAmount && p.tokenAmount > 0) {
        const result = closePaperSell(current, p.id, exitCap && exitCap > 0 ? exitCap : p.entryMarketCap, {
          closeReason: reason,
          exitPriceUsd: exitPrice,
          copyGrossProceedsUsd: p.tokenAmount * exitPrice,
        });
        if (result.ok) {
          current = result.state;
          closed.push(result.trade);
        }
      } else if (exitCap && exitCap > 0) {
        const result = closePaperSell(current, p.id, exitCap, {
          closeReason: reason,
          exitPriceUsd: exitPrice,
        });
        if (result.ok) {
          current = result.state;
          closed.push(result.trade);
        }
      }
    }
  }

  return { state: current, closed };
}

export function summarize(state: PaperState) {
  let unrealizedPnl = 0;
  let openMarkValue = 0;
  let withStop = 0;
  let withTarget = 0;
  for (const p of state.positions) {
    const { mark } = positionMarkValue(p);
    openMarkValue += mark;
    unrealizedPnl += mark - p.costBasis;
    if (p.stopLossPrice || p.stopLossMarketCap) withStop += 1;
    if (p.takeProfitPrice || p.takeProfitMarketCap) withTarget += 1;
  }
  const realizedPnl = state.realized.reduce((s, t) => s + t.realizedPnl, 0);
  const equity = state.cashUsd + openMarkValue;
  const netPnl = equity - state.startingBankroll;
  const creatorFeeTotal = Object.values(state.creatorFees).reduce(
    (s, b) => s + b.totalFeesUsd,
    0
  );
  const autoClosedStop = state.realized.filter(
    (t) => t.closeReason === "stop"
  ).length;
  const autoClosedTp = state.realized.filter(
    (t) => t.closeReason === "take_profit"
  ).length;
  return {
    unrealizedPnl,
    realizedPnl,
    openMarkValue,
    equity,
    netPnl,
    creatorFeeTotal,
    openCount: state.positions.length,
    withStop,
    withTarget,
    autoClosedStop,
    autoClosedTp,
  };
}

export function setSlippageRate(
  state: PaperState,
  rate: number
): PaperState {
  if (!(rate >= 0 && rate <= 0.5)) return state;
  return { ...state, slippageRate: rate };
}

export function resetPaperAccount(keepSlippage: PaperState): PaperState {
  const next = createInitialState();
  next.slippageRate = keepSlippage.slippageRate;
  return next;
}

export function previewMemeBuyFill(
  quotedMarketCap: number,
  stakeUsd: number,
  creatorFeeRate: number,
  slippageRate: number
) {
  const fee = stakeUsd * creatorFeeRate;
  const cost = stakeUsd + fee;
  const slippedCap = slippedBuyMarketCap(quotedMarketCap, slippageRate);
  return {
    fee,
    cost,
    quotedMarketCap,
    slippedEntryMarketCap: slippedCap,
    slippageRate,
  };
}

export function previewMemeSellFill(
  position: PaperPosition,
  quotedExitMarketCap: number,
  creatorFeeRate: number,
  slippageRate: number
) {
  const slippedCap = slippedSellMarketCap(quotedExitMarketCap, slippageRate);
  const gross = markToMarketValue(
    position.stakeUsd,
    position.entryMarketCap,
    slippedCap
  );
  const sellFee = gross * creatorFeeRate;
  return {
    quotedExitMarketCap,
    slippedExitMarketCap: slippedCap,
    grossProceeds: gross,
    sellFeeUsd: sellFee,
    netProceeds: gross - sellFee,
    slippageRate,
  };
}

export type { PositionSource };
