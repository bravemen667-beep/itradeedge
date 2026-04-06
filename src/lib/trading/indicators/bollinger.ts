export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): BollingerBands {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
    const sd = Math.sqrt(variance);

    middle.push(sma);
    upper.push(sma + stdDev * sd);
    lower.push(sma - stdDev * sd);
    bandwidth.push(sma !== 0 ? ((stdDev * 2 * sd) / sma) * 100 : 0);
  }

  return { upper, middle, lower, bandwidth };
}

/**
 * Bollinger Band position signal
 */
export function bollingerSignal(
  price: number,
  bands: BollingerBands
): { touchUpper: boolean; touchLower: boolean; percentB: number } {
  const idx = bands.upper.length - 1;
  const upper = bands.upper[idx];
  const lower = bands.lower[idx];
  const range = upper - lower;

  return {
    touchUpper: price >= upper * 0.998,
    touchLower: price <= lower * 1.002,
    percentB: range !== 0 ? (price - lower) / range : 0.5,
  };
}
