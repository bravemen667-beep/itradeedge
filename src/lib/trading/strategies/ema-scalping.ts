/**
 * EMA Scalping Strategy (v0.1)
 * Timeframe: 1-Minute (Primary) | 15-Minute (Trend Filter)
 * EMAs: 9 | 50 | 150 | 200
 * RSI Period: 14 (custom thresholds: oversold < 40, overbought > 60)
 * Risk per trade: 1% of total account
 * Risk:Reward: 1:2 (trailing SL to breakeven at 1:1)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TradeDirection = "BUY" | "SELL" | "NO_TRADE";
export type MarketTrend = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

export interface EMAValues {
  ema9: number;
  ema50: number;
  ema150: number;
  ema200: number;
}

export interface StrategyInput {
  candle1m: Candle;
  ema1m: EMAValues;
  rsi1m: number;
  trend15m: MarketTrend;
  recentHighs1m: number[];
  recentLows1m: number[];
  accountBalance: number;
}

export interface TradeSignal {
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  trailingSLTrigger: number;
  riskAmount: number;
  positionSize: number;
  reason: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isHigherHighs(highs: number[]): boolean {
  if (highs.length < 2) return false;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i] <= highs[i - 1]) return false;
  }
  return true;
}

export function isLowerLows(lows: number[]): boolean {
  if (lows.length < 2) return false;
  for (let i = 1; i < lows.length; i++) {
    if (lows[i] >= lows[i - 1]) return false;
  }
  return true;
}

export function isGreenCandle(candle: Candle): boolean {
  return candle.close > candle.open;
}

export function isRedCandle(candle: Candle): boolean {
  return candle.close < candle.open;
}

export function calcPositionSize(
  accountBalance: number,
  entry: number,
  stopLoss: number,
  riskPercent = 0.01
): { riskAmount: number; positionSize: number } {
  const riskAmount = accountBalance * riskPercent;
  const pipRisk = Math.abs(entry - stopLoss);
  const positionSize = pipRisk > 0 ? riskAmount / pipRisk : 0;
  return { riskAmount, positionSize };
}

// ─── Core Strategy Logic ──────────────────────────────────────────────────────

export function evaluateEMAScalpStrategy(input: StrategyInput): TradeSignal {
  const { candle1m, ema1m, rsi1m, trend15m, recentHighs1m, recentLows1m, accountBalance } = input;
  const { ema9, ema50 } = ema1m;

  // ── BUY CONDITIONS ─────────────────────────────────────────────────────────
  const isBuySignal =
    isGreenCandle(candle1m) &&
    candle1m.close > ema9 &&
    candle1m.close > ema50 &&
    isHigherHighs(recentHighs1m) &&
    rsi1m < 40 &&
    trend15m === "BULLISH" &&
    candle1m.low <= ema9 * 1.001;

  if (isBuySignal) {
    const entry = candle1m.close;
    const stopLoss = Math.min(candle1m.low, ema9) - entry * 0.001;
    const riskPips = entry - stopLoss;
    const takeProfit = entry + riskPips * 2;
    const trailingSLTrigger = entry + riskPips;
    const { riskAmount, positionSize } = calcPositionSize(accountBalance, entry, stopLoss);

    return {
      direction: "BUY",
      entry,
      stopLoss,
      takeProfit,
      trailingSLTrigger,
      riskAmount,
      positionSize,
      reason: `BUY: Green candle above 9 & 50 EMA. HH structure. RSI oversold (${rsi1m.toFixed(1)} < 40). 15m bullish. Pullback to 9 EMA.`,
    };
  }

  // ── SELL CONDITIONS ────────────────────────────────────────────────────────
  const isSellSignal =
    isRedCandle(candle1m) &&
    candle1m.close < ema9 &&
    candle1m.close < ema50 &&
    isLowerLows(recentLows1m) &&
    rsi1m > 60 &&
    trend15m === "BEARISH" &&
    candle1m.high >= ema9 * 0.999;

  if (isSellSignal) {
    const entry = candle1m.close;
    const stopLoss = Math.max(candle1m.high, ema9) + entry * 0.001;
    const riskPips = stopLoss - entry;
    const takeProfit = entry - riskPips * 2;
    const trailingSLTrigger = entry - riskPips;
    const { riskAmount, positionSize } = calcPositionSize(accountBalance, entry, stopLoss);

    return {
      direction: "SELL",
      entry,
      stopLoss,
      takeProfit,
      trailingSLTrigger,
      riskAmount,
      positionSize,
      reason: `SELL: Red candle below 9 & 50 EMA. LL structure. RSI overbought (${rsi1m.toFixed(1)} > 60). 15m bearish. Pullback to 9 EMA.`,
    };
  }

  return {
    direction: "NO_TRADE",
    entry: 0,
    stopLoss: 0,
    takeProfit: 0,
    trailingSLTrigger: 0,
    riskAmount: 0,
    positionSize: 0,
    reason: "Conditions not met. No trade.",
  };
}

// ─── Trailing SL Manager ──────────────────────────────────────────────────────

export function manageTrailingSL(
  direction: TradeDirection,
  currentPrice: number,
  signal: TradeSignal
): number {
  if (direction === "BUY" && currentPrice >= signal.trailingSLTrigger) {
    return Math.max(signal.stopLoss, signal.entry);
  }
  if (direction === "SELL" && currentPrice <= signal.trailingSLTrigger) {
    return Math.min(signal.stopLoss, signal.entry);
  }
  return signal.stopLoss;
}
