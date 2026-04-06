import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [closedTrades, snapshots, strategyStats] = await Promise.all([
    prisma.trade.findMany({
      where: { status: "CLOSED", exitTime: { gte: since } },
      orderBy: { exitTime: "asc" },
      select: {
        profit: true,
        profitPercent: true,
        exitTime: true,
        pair: true,
        strategy: { select: { name: true, type: true } },
      },
    }),
    prisma.performanceSnapshot.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.strategy.findMany({
      select: {
        name: true,
        type: true,
        winRate: true,
        totalTrades: true,
        profitFactor: true,
      },
    }),
  ]);

  // Calculate analytics
  const totalProfit = closedTrades.reduce((s, t) => s + (t.profit || 0), 0);
  const winners = closedTrades.filter((t) => (t.profit || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;

  const grossProfit = winners.reduce((s, t) => s + (t.profit || 0), 0);
  const grossLoss = Math.abs(
    closedTrades
      .filter((t) => (t.profit || 0) < 0)
      .reduce((s, t) => s + (t.profit || 0), 0)
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Daily P&L breakdown
  const dailyPnl: Record<string, number> = {};
  for (const trade of closedTrades) {
    if (trade.exitTime) {
      const day = trade.exitTime.toISOString().split("T")[0];
      dailyPnl[day] = (dailyPnl[day] || 0) + (trade.profit || 0);
    }
  }

  // Pair performance
  const pairPerf: Record<string, { profit: number; count: number; wins: number }> = {};
  for (const trade of closedTrades) {
    if (!pairPerf[trade.pair]) pairPerf[trade.pair] = { profit: 0, count: 0, wins: 0 };
    pairPerf[trade.pair].profit += trade.profit || 0;
    pairPerf[trade.pair].count++;
    if ((trade.profit || 0) > 0) pairPerf[trade.pair].wins++;
  }

  return NextResponse.json({
    summary: {
      totalProfit,
      winRate,
      profitFactor,
      totalTrades: closedTrades.length,
      avgProfit: closedTrades.length > 0 ? totalProfit / closedTrades.length : 0,
    },
    dailyPnl: Object.entries(dailyPnl).map(([date, pnl]) => ({ date, pnl })),
    pairPerformance: Object.entries(pairPerf).map(([pair, data]) => ({
      pair,
      ...data,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
    })),
    strategyStats,
    equityCurve: snapshots.map((s) => ({
      timestamp: s.timestamp.toISOString(),
      equity: s.equity,
      drawdown: s.drawdown,
    })),
  });
}
