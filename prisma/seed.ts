import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed strategies
  const strategies = [
    {
      name: "Trend Following",
      type: "TREND_FOLLOWING",
      enabled: true,
      description:
        "EMA 9/21 crossover + ADX > 25 + MACD confirmation. Multi-timeframe: 15m entry, 1h trend, 4h bias. Galaxy Score > 65 filter.",
      parameters: {
        emaFast: 9,
        emaSlow: 21,
        adxThreshold: 25,
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        stopLoss: 2.5,
        takeProfit: 5,
        trailingStop: 1,
        timeframe: "15m",
        pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"],
      },
    },
    {
      name: "Mean Reversion",
      type: "MEAN_REVERSION",
      enabled: true,
      description:
        "RSI oversold/overbought + Bollinger Band touch. RANGING regime only (ADX < 20). Sentiment divergence filter.",
      parameters: {
        rsiPeriod: 14,
        rsiOversold: 30,
        rsiOverbought: 70,
        bbPeriod: 20,
        bbStdDev: 2,
        stopLoss: 1.5,
        takeProfit: 3,
        timeframe: "15m",
        pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
      },
    },
    {
      name: "Grid Trading",
      type: "GRID",
      enabled: false,
      description:
        "ATR-based grid spacing. Galaxy Score 40-60 stability filter. Auto-pauses during extreme sentiment spikes.",
      parameters: {
        gridLevels: 10,
        gridSpacing: 0.5,
        gridAmount: 50,
        stopLoss: 3,
        timeframe: "15m",
        pairs: ["BTC/USDT", "ETH/USDT"],
      },
    },
    {
      name: "ML Ensemble",
      type: "ML_ENSEMBLE",
      enabled: false,
      description:
        "XGBoost on combined price + social features. Weekly retraining on 90-day rolling window. Phase 3 — not yet active.",
      parameters: {
        maxOpenTrades: 2,
        stopLoss: 2,
        takeProfit: 4,
        timeframe: "1h",
        pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"],
      },
    },
  ];

  for (const strategy of strategies) {
    await prisma.strategy.upsert({
      where: { name: strategy.name },
      update: strategy,
      create: strategy,
    });
  }

  console.log("Seeded 4 strategies");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
