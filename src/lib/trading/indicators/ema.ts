/**
 * Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  // SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result.push(sum / period);

  // EMA for rest
  for (let i = period; i < data.length; i++) {
    const ema = (data[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Check for EMA crossover (fast crosses above slow = bullish)
 */
export function emaCrossover(
  fast: number[],
  slow: number[]
): { bullish: boolean; bearish: boolean } {
  if (fast.length < 2 || slow.length < 2) return { bullish: false, bearish: false };

  const currFast = fast[fast.length - 1];
  const prevFast = fast[fast.length - 2];
  const currSlow = slow[slow.length - 1];
  const prevSlow = slow[slow.length - 2];

  return {
    bullish: prevFast <= prevSlow && currFast > currSlow,
    bearish: prevFast >= prevSlow && currFast < currSlow,
  };
}
