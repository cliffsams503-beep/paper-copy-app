/** Quick assertion script for slippage / fee math (no Jest). */
function slippedBuyMarketCap(q, s) { return q * (1 + s); }
function slippedSellMarketCap(q, s) { return q * (1 - s); }
function slippedTokenAmount(q, s) { return q * (1 - s); }
function markToMarketValue(stake, entry, cur) {
  return entry <= 0 ? stake : stake * (cur / entry);
}
function near(a, b, eps = 1e-6) {
  if (Math.abs(a - b) > eps) throw new Error(`expected ${b}, got ${a}`);
}

const slip = 0.1;
const quotedCap = 100_000;
const stake = 100;
const feeRate = 0.003;

const entry = slippedBuyMarketCap(quotedCap, slip);
near(entry, 110_000);
const buyFee = stake * feeRate;
const cost = stake + buyFee;
near(cost, 100.3);

const exitQuoted = 120_000;
const exitSlipped = slippedSellMarketCap(exitQuoted, slip);
near(exitSlipped, 108_000);
const gross = markToMarketValue(stake, entry, exitSlipped);
const sellFee = gross * feeRate;
const net = gross - sellFee;
if (!(gross < markToMarketValue(stake, entry, exitQuoted))) throw new Error("sell slip worsens");
if (!(net < gross)) throw new Error("meme sell fee subtracted");

const quotedOut = 1_000_000;
const slippedOut = slippedTokenAmount(quotedOut, slip);
near(slippedOut, 900_000);

const copyCost = 50;
const copyScoreboardFee = copyCost * feeRate;
const copyBasis = copyCost;
near(copyBasis, 50);
near(copyScoreboardFee, 0.15);

const copyGrossPre = 60;
const copyGross = copyGrossPre * (1 - slip);
const copySellFeeBucket = copyGross * feeRate;
const copyNet = copyGross;
near(copyGross, 54);
near(copyNet, copyGross);
if (!(copySellFeeBucket > 0)) throw new Error("copy sell fee bucket");

console.log("assert-slippage: all checks passed");
