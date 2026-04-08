import { NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

export async function GET() {
  try {
    const [profit, daily, perf] = await Promise.allSettled([
      ftProxy<Record<string, unknown>>("/profit"),
      ftProxy<{ data: { date: string; abs_profit: number }[] }>("/daily?timescale=30"),
      ftProxy<{ pair: string; profit: number; count: number }[]>("/performance"),
    ]);
    const p = profit.status === "fulfilled" ? profit.value : null;
    const d = daily.status === "fulfilled" ? daily.value : null;
    const pp = perf.status === "fulfilled" ? perf.value : [];
    return NextResponse.json({
      summary: {
        totalProfit: (p?.profit_closed_coin as number) || 0,
        winRate: p ? ((p.winning_trades as number) || 0) / Math.max((p.closed_trade_count as number) || 1, 1) * 100 : 0,
        profitFactor: (p?.profit_factor as number) || 0,
        totalTrades: (p?.closed_trade_count as number) || 0,
      },
      dailyPnl: d?.data?.map((x) => ({ date: x.date, pnl: x.abs_profit })) || [],
      pairPerformance: pp.map((x) => ({ pair: x.pair, profit: x.profit, count: x.count })),
    });
  } catch {
    return NextResponse.json({ summary: { totalProfit: 0, winRate: 0, profitFactor: 0, totalTrades: 0 }, dailyPnl: [], pairPerformance: [] });
  }
}
