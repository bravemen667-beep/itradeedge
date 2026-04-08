import { NextRequest, NextResponse } from "next/server";

// Static strategy definitions — no DB dependency
const STRATEGIES = [
  {
    id: "1", name: "Babybot Trend", type: "TREND_FOLLOWING", enabled: true,
    description: "EMA alignment + ADX + OBV trend continuation. 4h timeframe. Hyperopt-optimized: +237% backtest.",
    parameters: { adxThreshold: 16, rsiLow: 39, rsiHigh: 80, emaSlopeMin: 0.05, timeframe: "4h" },
    winRate: 51, totalTrades: 404, profitFactor: 1.87, createdAt: "2026-04-07", updatedAt: "2026-04-08",
  },
  {
    id: "2", name: "Miesse Multi-Factor", type: "MULTI_FACTOR", enabled: true,
    description: "5-factor scoring (momentum/volume/trend/RS/setup). 1h timeframe. Hyperopt-optimized: +154% backtest.",
    parameters: { scoreThreshold: 60, volSurgeMult: 1.5, timeframe: "1h" },
    winRate: 47, totalTrades: 538, profitFactor: 1.54, createdAt: "2026-04-07", updatedAt: "2026-04-08",
  },
  {
    id: "3", name: "EMA Scalping", type: "EMA_SCALPING", enabled: true,
    description: "1m EMA 9/50/150/200 + RSI < 40 + HH structure + 15m trend filter. 1:2 R:R.",
    parameters: { emaFast: 9, emaMedium: 50, emaSlow: 150, emaMajor: 200, rsiOversold: 40, timeframe: "1m" },
    winRate: 0, totalTrades: 0, profitFactor: 0, createdAt: "2026-04-07", updatedAt: "2026-04-07",
  },
  {
    id: "4", name: "Trend Following", type: "TREND_FOLLOWING", enabled: true,
    description: "EMA 9/21 crossover + ADX > 25 + MACD confirmation. 15m timeframe.",
    parameters: { emaFast: 9, emaSlow: 21, adxThreshold: 25, timeframe: "15m" },
    winRate: 38, totalTrades: 735, profitFactor: 0.57, createdAt: "2026-04-06", updatedAt: "2026-04-08",
  },
  {
    id: "5", name: "Davey Breakout", type: "BREAKOUT", enabled: true,
    description: "N-bar high breakout with volume confirmation. Walk-forward validated. 1h timeframe.",
    parameters: { lookback: 20, volFilter: 1.5, atrStopMult: 2.0, timeframe: "1h" },
    winRate: 59, totalTrades: 1585, profitFactor: 0.72, createdAt: "2026-04-07", updatedAt: "2026-04-08",
  },
  {
    id: "6", name: "Mean Reversion", type: "MEAN_REVERSION", enabled: false,
    description: "RSI oversold/overbought + Bollinger Band touch. RANGING regime only. 15m timeframe.",
    parameters: { rsiOversold: 30, rsiOverbought: 70, bbPeriod: 20, timeframe: "15m" },
    winRate: 45, totalTrades: 390, profitFactor: 0.46, createdAt: "2026-04-06", updatedAt: "2026-04-08",
  },
  {
    id: "7", name: "Davey BB Reversion", type: "MEAN_REVERSION", enabled: false,
    description: "Bollinger Band mean reversion + RSI. Walk-forward validated. 1h timeframe.",
    parameters: { bbPeriod: 20, bbStd: 2.0, rsiBuy: 35, timeframe: "1h" },
    winRate: 0, totalTrades: 0, profitFactor: 0, createdAt: "2026-04-07", updatedAt: "2026-04-08",
  },
  {
    id: "8", name: "Capablanca Fade", type: "REVERSAL", enabled: false,
    description: "Capitulation dip-buy: crash reversal on spike volume + RSI oversold. 1h timeframe.",
    parameters: { spikeThreshold: -15, rsiOversold: 25, volSpikeMult: 2.0, timeframe: "1h" },
    winRate: 0, totalTrades: 0, profitFactor: 0, createdAt: "2026-04-07", updatedAt: "2026-04-08",
  },
  {
    id: "9", name: "Grid Trading", type: "GRID", enabled: false,
    description: "ATR-based grid spacing. Galaxy Score 40-60 stability filter. 15m timeframe.",
    parameters: { gridLevels: 10, gridSpacing: 0.5, timeframe: "15m" },
    winRate: 59, totalTrades: 47, profitFactor: 1.45, createdAt: "2026-04-06", updatedAt: "2026-04-06",
  },
  {
    id: "10", name: "Sentiment Adaptive", type: "SENTIMENT", enabled: false,
    description: "LunarCrush Galaxy Score entry gate + dynamic position sizing. 15m timeframe.",
    parameters: { galaxyMin: 65, rsiEntryLow: 40, rsiEntryHigh: 65, timeframe: "15m" },
    winRate: 0, totalTrades: 0, profitFactor: 0, createdAt: "2026-04-06", updatedAt: "2026-04-06",
  },
];

export async function GET() {
  return NextResponse.json(STRATEGIES);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ...body, id: String(STRATEGIES.length + 1) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json(body);
}
