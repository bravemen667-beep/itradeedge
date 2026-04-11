import { calculateEMA } from "./ema";

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/**
 * Moving Average Convergence Divergence
 */
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // Align arrays. Under normal use fastEMA is longer than slowEMA (smaller
  // period -> more samples), so offset >= 0. If a caller inverts the periods
  // or feeds malformed data, offset could go negative — slice(-n) would then
  // silently return the LAST n elements instead of erroring, producing
  // mathematically wrong MACD output. Bail out cleanly instead.
  const offset = fastEMA.length - slowEMA.length;
  if (offset < 0) {
    return { macd: [], signal: [], histogram: [] };
  }
  const alignedFast = fastEMA.slice(offset);

  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(alignedFast[i] - slowEMA[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histOffset = macdLine.length - signalLine.length;
  const alignedMACD = macdLine.slice(histOffset);

  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(alignedMACD[i] - signalLine[i]);
  }

  return { macd: alignedMACD, signal: signalLine, histogram };
}

/**
 * MACD crossover signal
 */
export function macdSignal(result: MACDResult): {
  bullish: boolean;
  bearish: boolean;
  histogram: number;
} {
  const { histogram } = result;
  if (histogram.length < 2) return { bullish: false, bearish: false, histogram: 0 };

  const curr = histogram[histogram.length - 1];
  const prev = histogram[histogram.length - 2];

  return {
    bullish: prev < 0 && curr > 0,
    bearish: prev > 0 && curr < 0,
    histogram: curr,
  };
}
