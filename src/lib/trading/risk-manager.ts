import type { IntelligenceSignal } from "@/types/intelligence";

interface RiskConfig {
  maxDrawdown: number;        // Maximum allowed drawdown percentage (e.g., 15)
  maxPositionSize: number;    // Max % of portfolio per trade (e.g., 10)
  maxOpenTrades: number;      // Maximum concurrent positions
  riskPerTrade: number;       // Risk % per trade (e.g., 2)
  maxDailyLoss: number;       // Max daily loss % before pausing
  maxCorrelation: number;     // Max correlation between open positions
}

const DEFAULT_CONFIG: RiskConfig = {
  maxDrawdown: 15,
  maxPositionSize: 10,
  maxOpenTrades: 3,
  riskPerTrade: 2,
  maxDailyLoss: 5,
  maxCorrelation: 0.7,
};

export class RiskManager {
  private config: RiskConfig;

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate position size based on account equity, risk per trade, and stop distance
   */
  calculatePositionSize(
    equity: number,
    entryPrice: number,
    stopLoss: number,
    signal?: IntelligenceSignal
  ): number {
    const riskAmount = equity * (this.config.riskPerTrade / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);

    if (stopDistance === 0) return 0;

    let positionSize = riskAmount / stopDistance;

    // Cap at max position size
    const maxSize = (equity * this.config.maxPositionSize / 100) / entryPrice;
    positionSize = Math.min(positionSize, maxSize);

    // Adjust by sentiment conviction if signal available
    if (signal) {
      const multiplier = this.getSentimentMultiplier(signal);
      positionSize *= multiplier;
    }

    return Math.round(positionSize * 1000) / 1000;
  }

  /**
   * Calculate stop loss based on ATR
   */
  calculateStopLoss(
    entryPrice: number,
    atr: number,
    side: "BUY" | "SELL",
    multiplier = 2.5
  ): number {
    const stopDistance = atr * multiplier;
    return side === "BUY"
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
  }

  /**
   * Calculate take profit based on risk:reward ratio
   */
  calculateTakeProfit(
    entryPrice: number,
    stopLoss: number,
    side: "BUY" | "SELL",
    rrRatio = 2
  ): number {
    const risk = Math.abs(entryPrice - stopLoss);
    return side === "BUY"
      ? entryPrice + risk * rrRatio
      : entryPrice - risk * rrRatio;
  }

  /**
   * Check if we should halt trading (drawdown or daily loss exceeded)
   */
  shouldHaltTrading(
    currentEquity: number,
    peakEquity: number,
    dailyPnl: number
  ): { halt: boolean; reason?: string } {
    const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;

    if (drawdown >= this.config.maxDrawdown) {
      return { halt: true, reason: `Max drawdown exceeded: ${drawdown.toFixed(1)}%` };
    }

    if (Math.abs(dailyPnl) >= this.config.maxDailyLoss) {
      return { halt: true, reason: `Max daily loss exceeded: ${dailyPnl.toFixed(1)}%` };
    }

    return { halt: false };
  }

  /**
   * Check if we can open a new trade
   */
  canOpenTrade(openTradeCount: number): boolean {
    return openTradeCount < this.config.maxOpenTrades;
  }

  /**
   * Get trailing stop price
   */
  calculateTrailingStop(
    currentPrice: number,
    highestPrice: number,
    trailingPercent: number,
    side: "BUY" | "SELL"
  ): number {
    if (side === "BUY") {
      return highestPrice * (1 - trailingPercent / 100);
    }
    return highestPrice * (1 + trailingPercent / 100);
  }

  private getSentimentMultiplier(signal: IntelligenceSignal): number {
    if (signal.galaxyScore >= 80 && signal.confidence >= 0.8) return 1.5;
    if (signal.galaxyScore >= 70 && signal.confidence >= 0.7) return 1.2;
    if (signal.galaxyScore >= 60 && signal.confidence >= 0.6) return 1.0;
    return 0.5;
  }
}

export const riskManager = new RiskManager();
