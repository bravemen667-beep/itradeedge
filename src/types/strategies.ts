export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  enabled: boolean;
  parameters: StrategyParameters;
  description?: string;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  createdAt: string;
  updatedAt: string;
}

export type StrategyType = "TREND_FOLLOWING" | "MEAN_REVERSION" | "GRID" | "ML_ENSEMBLE" | "EMA_SCALPING" | "BREAKOUT" | "REVERSAL" | "RISK_MGMT" | "SENTIMENT" | "MULTI_FACTOR";

export interface StrategyParameters {
  // Trend Following
  emaFast?: number;
  emaSlow?: number;
  adxThreshold?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;

  // Mean Reversion
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  bbPeriod?: number;
  bbStdDev?: number;

  // Grid Trading
  gridLevels?: number;
  gridSpacing?: number;
  gridAmount?: number;

  // EMA Scalping
  emaMedium?: number;
  emaMajor?: number;

  // Common
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  maxOpenTrades?: number;
  pairs?: string[];
  timeframe?: string;
}

export interface BacktestResult {
  strategyName: string;
  period: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equityCurve: { timestamp: string; equity: number }[];
}

export interface BacktestTrade {
  pair: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  entryTime: string;
  exitTime: string;
  duration: string;
}
