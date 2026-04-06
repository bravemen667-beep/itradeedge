import type { MarketRegime } from "@/types/trading";

interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class RegimeDetector {
  /**
   * Classify current market regime using ADX + volatility
   * TRENDING: ADX > 25 and directional movement
   * RANGING: ADX < 20 and low volatility
   * VOLATILE: High ATR relative to price
   * LOW_CONFIDENCE: Insufficient data or mixed signals
   */
  detect(candles: OHLCV[]): MarketRegime {
    if (candles.length < 30) return "LOW_CONFIDENCE";

    const adx = this.calculateADX(candles, 14);
    const atrPercent = this.calculateATRPercent(candles, 14);
    const currentADX = adx[adx.length - 1];

    // High volatility override
    if (atrPercent > 5) return "VOLATILE";

    if (currentADX > 25) return "TRENDING";
    if (currentADX < 20 && atrPercent < 2) return "RANGING";
    if (currentADX >= 20 && currentADX <= 25) return "LOW_CONFIDENCE";

    return "RANGING";
  }

  /**
   * Check if a strategy should be active given the regime
   */
  shouldStrategyRun(strategyType: string, regime: MarketRegime): boolean {
    switch (strategyType) {
      case "TREND_FOLLOWING":
        return regime === "TRENDING";
      case "MEAN_REVERSION":
        return regime === "RANGING";
      case "GRID":
        return regime === "RANGING" || regime === "LOW_CONFIDENCE";
      case "ML_ENSEMBLE":
        return regime !== "VOLATILE"; // ML runs in all except extreme volatility
      default:
        return true;
    }
  }

  private calculateADX(candles: OHLCV[], period: number): number[] {
    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevHigh = candles[i - 1].high;
      const prevLow = candles[i - 1].low;
      const prevClose = candles[i - 1].close;

      tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));

      const upMove = high - prevHigh;
      const downMove = prevLow - low;

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    const smoothedTR = this.wilderSmooth(tr, period);
    const smoothedPlusDM = this.wilderSmooth(plusDM, period);
    const smoothedMinusDM = this.wilderSmooth(minusDM, period);

    const plusDI: number[] = [];
    const minusDI: number[] = [];
    const dx: number[] = [];

    for (let i = 0; i < smoothedTR.length; i++) {
      const pdi = smoothedTR[i] !== 0 ? (smoothedPlusDM[i] / smoothedTR[i]) * 100 : 0;
      const mdi = smoothedTR[i] !== 0 ? (smoothedMinusDM[i] / smoothedTR[i]) * 100 : 0;
      plusDI.push(pdi);
      minusDI.push(mdi);
      const sum = pdi + mdi;
      dx.push(sum !== 0 ? (Math.abs(pdi - mdi) / sum) * 100 : 0);
    }

    return this.wilderSmooth(dx, period);
  }

  private calculateATRPercent(candles: OHLCV[], period: number): number {
    const tr: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    const recentTR = tr.slice(-period);
    const atr = recentTR.reduce((s, v) => s + v, 0) / recentTR.length;
    const currentPrice = candles[candles.length - 1].close;
    return (atr / currentPrice) * 100;
  }

  private wilderSmooth(data: number[], period: number): number[] {
    if (data.length < period) return [];
    const result: number[] = [];
    let sum = data.slice(0, period).reduce((s, v) => s + v, 0);
    result.push(sum / period);
    for (let i = period; i < data.length; i++) {
      sum = sum - sum / period + data[i];
      result.push(sum / period);
    }
    return result;
  }
}

export const regimeDetector = new RegimeDetector();
