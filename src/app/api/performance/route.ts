import { NextResponse } from "next/server";

const FT_BASE = "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FT_USER = "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "Imperial99Trade!";

async function ftFetch(path: string) {
  const encoded = Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64");
  const res = await fetch(`${FT_BASE}${path}`, {
    headers: { Authorization: `Basic ${encoded}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Freqtrade ${res.status}`);
  return res.json();
}

export async function GET() {
  try {
    const [profit, daily, perf] = await Promise.allSettled([
      ftFetch("/profit"),
      ftFetch("/daily?timescale=30"),
      ftFetch("/performance"),
    ]);

    const profitData = profit.status === "fulfilled" ? profit.value : null;
    const dailyData = daily.status === "fulfilled" ? daily.value : null;
    const perfData = perf.status === "fulfilled" ? perf.value : [];

    return NextResponse.json({
      summary: {
        totalProfit: profitData?.profit_closed_coin || 0,
        winRate: profitData
          ? profitData.winning_trades / Math.max(profitData.closed_trade_count, 1) * 100
          : 0,
        profitFactor: profitData
          ? Math.abs(profitData.profit_all_coin / Math.min(profitData.profit_closed_coin || 1, -0.01))
          : 0,
        totalTrades: profitData?.closed_trade_count || 0,
        avgProfit: profitData?.closed_trade_count
          ? profitData.profit_closed_coin / profitData.closed_trade_count
          : 0,
      },
      dailyPnl: dailyData?.data?.map((d: { date: string; abs_profit: number }) => ({
        date: d.date,
        pnl: d.abs_profit,
      })) || [],
      pairPerformance: (perfData as { pair: string; profit: number; count: number }[]).map(
        (p: { pair: string; profit: number; count: number }) => ({
          pair: p.pair,
          profit: p.profit,
          count: p.count,
          winRate: 0,
        })
      ),
      strategyStats: [],
      equityCurve: [],
    });
  } catch (error) {
    return NextResponse.json({
      summary: { totalProfit: 0, winRate: 0, profitFactor: 0, totalTrades: 0, avgProfit: 0 },
      dailyPnl: [],
      pairPerformance: [],
      strategyStats: [],
      equityCurve: [],
      error: String(error),
    });
  }
}
