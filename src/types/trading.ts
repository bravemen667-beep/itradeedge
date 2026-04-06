export interface KPIData {
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  openPositions: number;
  equity: number;
  drawdown: number;
  sharpeRatio: number;
  dailyPnl: number;
}

export interface Position {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  currentPrice: number;
  amount: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy: string;
  entryTime: string;
}

export interface TradeHistory {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  profit: number;
  profitPercent: number;
  strategy: string;
  entryTime: string;
  exitTime: string;
  regime?: string;
  galaxyScore?: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  drawdown: number;
}

export interface BalanceInfo {
  total: number;
  free: number;
  used: number;
  currency: string;
}

export type MarketRegime = "TRENDING" | "RANGING" | "VOLATILE" | "LOW_CONFIDENCE";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  exchange: { connected: boolean; balance: number };
  freqtrade: { connected: boolean; running: boolean; version?: string };
  database: { connected: boolean };
  lunarcrush: { connected: boolean; requestsRemaining?: number };
  telegram: { connected: boolean };
  timestamp: string;
}
