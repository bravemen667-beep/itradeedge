import { NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

// Static list of strategies the dashboard knows about. The current proxy only
// reaches the babybot directly, so live numbers are populated for the active
// strategy and zero-stub rows are returned for the others. The frontend
// renders all 5 in the Strategies table.
const STRATEGY_CATALOG = [
  { name: "BabybotTrend", type: "TREND_FOLLOWING" },
  { name: "TrendFollowing", type: "TREND_FOLLOWING" },
  { name: "MiesseMultiFactor", type: "MULTI_FACTOR" },
  { name: "EMAScalping", type: "EMA_SCALPING" },
  { name: "DaveyBreakout", type: "BREAKOUT" },
];

interface FreqtradeProfit {
  profit_closed_coin?: number;
  profit_factor?: number;
  closed_trade_count?: number;
  winning_trades?: number;
  losing_trades?: number;
}

interface DailyEntry {
  date: string;
  abs_profit: number;
}

interface PairPerf {
  pair: string;
  profit: number;
  count: number;
}

const STARTING_EQUITY = 10000;

export async function GET() {
  try {
    const [profitR, dailyR, perfR, configR] = await Promise.allSettled([
      ftProxy<FreqtradeProfit>("/profit"),
      ftProxy<{ data: DailyEntry[] }>("/daily?timescale=30"),
      ftProxy<PairPerf[]>("/performance"),
      ftProxy<{ strategy?: string }>("/show_config"),
    ]);
    const p = profitR.status === "fulfilled" ? profitR.value : null;
    const d = dailyR.status === "fulfilled" ? dailyR.value : null;
    const pp = perfR.status === "fulfilled" ? perfR.value : [];
    const cfg = configR.status === "fulfilled" ? configR.value : null;

    const totalProfit = p?.profit_closed_coin ?? 0;
    const totalTrades = p?.closed_trade_count ?? 0;
    const winningTrades = p?.winning_trades ?? 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const profitFactor = p?.profit_factor ?? 0;

    // freqtrade /daily returns most-recent first; reverse to chronological
    // so the cumulative equity curve runs forward in time.
    const dailyChrono = (d?.data ?? []).slice().reverse();
    const dailyPnl = dailyChrono.map((x) => ({ date: x.date, pnl: x.abs_profit }));

    // Cumulative equity curve derived from dailyPnl. Tracks running peak so we
    // can compute drawdown without a separate API call.
    let equity = STARTING_EQUITY;
    let peak = STARTING_EQUITY;
    const equityCurve = dailyPnl.map((dp) => {
      equity += dp.pnl;
      if (equity > peak) peak = equity;
      const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      return { timestamp: dp.date, equity, drawdown };
    });

    // freqtrade /performance doesn't expose per-pair wins/winRate; the page
    // renders these columns regardless, so emit zero placeholders rather
    // than undefined which would crash the .toFixed() call site.
    const pairPerformance = pp.map((x) => ({
      pair: x.pair,
      profit: x.profit,
      count: x.count,
      wins: 0,
      winRate: 0,
    }));

    // Active strategy = whatever the freqtrade config currently reports. We
    // populate real stats for that one row and zero-stub the others. Once
    // the proxy supports multi-bot fan-out we can replace the stubs.
    const activeStrategy = cfg?.strategy ?? null;
    const strategyStats = STRATEGY_CATALOG.map((s) => {
      const isActive = activeStrategy != null && activeStrategy.includes(s.name);
      return {
        name: s.name,
        type: s.type,
        winRate: isActive ? winRate : 0,
        totalTrades: isActive ? totalTrades : 0,
        profitFactor: isActive ? profitFactor : 0,
      };
    });

    return NextResponse.json({
      summary: {
        totalProfit,
        winRate,
        profitFactor,
        totalTrades,
        avgProfit,
      },
      dailyPnl,
      pairPerformance,
      strategyStats,
      equityCurve,
    });
  } catch {
    // Total failure path — return the complete shape with zeros so the page
    // never sees undefined fields and never crashes the React render.
    return NextResponse.json({
      summary: {
        totalProfit: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        avgProfit: 0,
      },
      dailyPnl: [],
      pairPerformance: [],
      strategyStats: STRATEGY_CATALOG.map((s) => ({
        name: s.name,
        type: s.type,
        winRate: 0,
        totalTrades: 0,
        profitFactor: 0,
      })),
      equityCurve: [],
    });
  }
}
