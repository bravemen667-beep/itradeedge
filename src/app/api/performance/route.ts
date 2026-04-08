import { NextResponse } from "next/server";

const FT_BASE = "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FT_USER = "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "Imperial99Trade!";

let _jwt: { t: string; e: number } | null = null;
async function jwt() {
  if (_jwt && _jwt.e > Date.now()) return _jwt.t;
  const res = await fetch(`${FT_BASE}/token/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64")}` },
  });
  if (!res.ok) throw new Error(`Login: ${res.status}`);
  const d = await res.json();
  _jwt = { t: d.access_token, e: Date.now() + 840000 };
  return d.access_token;
}

async function ft(path: string) {
  const token = await jwt();
  const res = await fetch(`${FT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function GET() {
  try {
    const [profit, daily, perf] = await Promise.allSettled([
      ft("/profit"), ft("/daily?timescale=30"), ft("/performance"),
    ]);
    const p = profit.status === "fulfilled" ? profit.value : null;
    const dd = daily.status === "fulfilled" ? daily.value : null;
    const pp = perf.status === "fulfilled" ? perf.value : [];

    return NextResponse.json({
      summary: {
        totalProfit: p?.profit_closed_coin || 0,
        winRate: p ? p.winning_trades / Math.max(p.closed_trade_count, 1) * 100 : 0,
        profitFactor: p?.profit_factor || 0,
        totalTrades: p?.closed_trade_count || 0,
        avgProfit: p?.closed_trade_count ? p.profit_closed_coin / p.closed_trade_count : 0,
      },
      dailyPnl: dd?.data?.map((d: { date: string; abs_profit: number }) => ({ date: d.date, pnl: d.abs_profit })) || [],
      pairPerformance: (pp as { pair: string; profit: number; count: number }[]).map((x) => ({ pair: x.pair, profit: x.profit, count: x.count })),
      strategyStats: [], equityCurve: [],
    });
  } catch {
    return NextResponse.json({
      summary: { totalProfit: 0, winRate: 0, profitFactor: 0, totalTrades: 0, avgProfit: 0 },
      dailyPnl: [], pairPerformance: [], strategyStats: [], equityCurve: [],
    });
  }
}
