/**
 * Relative Strength Index
 */
export function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const result: number[] = [];
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  // Smoothed
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const smoothedRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + smoothedRS));
  }

  return result;
}

/**
 * Check RSI conditions
 */
export function rsiSignal(
  rsi: number[],
  oversold = 30,
  overbought = 70
): { oversold: boolean; overbought: boolean; value: number } {
  const current = rsi[rsi.length - 1];
  return {
    oversold: current <= oversold,
    overbought: current >= overbought,
    value: current,
  };
}
