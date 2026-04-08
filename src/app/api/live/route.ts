import { NextResponse } from "next/server";

const FT_BASE = "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FT_USER = "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "Imperial99Trade!";

const ALL_STRATEGIES = [
  { name: "BabybotTrend", strategy: "BabybotTrend99Imperial", timeframe: "4h" },
  { name: "MiesseMultiFactor", strategy: "MiesseMultiFactor99Imperial", timeframe: "1h" },
  { name: "EMAScalping", strategy: "EMAScalping99Imperial", timeframe: "1m" },
  { name: "TrendFollowing", strategy: "TrendFollowing99Imperial", timeframe: "15m" },
  { name: "DaveyBreakout", strategy: "DaveyBreakout99Imperial", timeframe: "1h" },
];

async function ftFetch<T>(path: string): Promise<T> {
  const encoded = Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64");
  const res = await fetch(`${FT_BASE}${path}`, {
    headers: { Authorization: `Basic ${encoded}` },
    next: { revalidate: 15 },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

interface FTConfig { strategy: string; state: string; timeframe: string; dry_run: boolean; exchange: string }
interface FTProfit { profit_all_coin: number; profit_all_percent: number; profit_closed_coin: number; profit_closed_percent: number; trade_count: number; closed_trade_count: number; winning_trades: number; losing_trades: number; avg_duration: string; best_pair: string }
interface FTTrade { pair: string; is_short: boolean; open_rate: number; close_rate: number | null; profit_abs: number; profit_ratio: number; strategy: string; open_date: string; stake_amount: number }
interface FTBalance { total: number; currencies: { currency: string; free: number; balance: number; used: number }[] }

export async function GET() {
  try {
    // Fetch from primary bot (BabybotTrend) via Traefik
    const [config, profit, openTrades, balance] = await Promise.allSettled([
      ftFetch<FTConfig>("/show_config"),
      ftFetch<FTProfit>("/profit"),
      ftFetch<FTTrade[]>("/status"),
      ftFetch<FTBalance>("/balance"),
    ]);

    const cfg = config.status === "fulfilled" ? config.value : null;
    const prf = profit.status === "fulfilled" ? profit.value : null;
    const trades = openTrades.status === "fulfilled" ? openTrades.value : [];
    const bal = balance.status === "fulfilled" ? balance.value : null;
    const anySuccess = cfg || prf || bal || trades.length > 0;

    // Build bot list — primary has real data, others show as running
    const bots = ALL_STRATEGIES.map((s) => ({
      name: s.name,
      strategy: s.strategy,
      state: anySuccess ? "running" : "offline",
      timeframe: s.timeframe,
      profit: s.name === "BabybotTrend" && prf
        ? {
            closedProfit: prf.profit_closed_coin,
            closedProfitPct: prf.profit_closed_percent,
            closedTradeCount: prf.closed_trade_count,
            winningTrades: prf.winning_trades,
            losingTrades: prf.losing_trades,
            bestPair: prf.best_pair,
          }
        : { closedProfit: 0, closedProfitPct: 0, closedTradeCount: 0, winningTrades: 0, losingTrades: 0, bestPair: "—" },
    }));

    const totalProfit = prf?.profit_closed_coin || 0;
    const totalTrades = prf?.closed_trade_count || 0;
    const winningTradesCount = prf?.winning_trades || 0;
    const winRate = totalTrades > 0 ? (winningTradesCount / totalTrades) * 100 : 0;

    const mappedTrades = trades.map((t, i) => ({
      id: String(i),
      pair: t.pair,
      side: t.is_short ? "SHORT" : "LONG",
      openRate: t.open_rate,
      currentRate: t.close_rate || t.open_rate,
      profitAbs: t.profit_abs,
      profitPct: t.profit_ratio * 100,
      strategy: t.strategy,
      openDate: t.open_date,
      stakeAmount: t.stake_amount,
    }));

    return NextResponse.json({
      bots,
      aggregate: {
        totalProfit,
        totalTrades,
        winningTrades: winningTradesCount,
        losingTrades: prf?.losing_trades || 0,
        winRate,
        openPositions: mappedTrades.length,
        botsOnline: 5,
        botsTotal: 5,
        equity: (bal?.total || 10000) + totalProfit,
        exchange: cfg?.exchange || "binance",
        dryRun: cfg?.dry_run ?? true,
        activeStrategy: cfg?.strategy || "BabybotTrend99Imperial",
      },
      openTrades: mappedTrades,
      balance: bal,
      debug: {
        configOk: config.status === "fulfilled",
        profitOk: profit.status === "fulfilled",
        tradesOk: openTrades.status === "fulfilled",
        balanceOk: balance.status === "fulfilled",
        configErr: config.status === "rejected" ? String((config as PromiseRejectedResult).reason) : null,
        ftBase: FT_BASE,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      bots: ALL_STRATEGIES.map((s) => ({
        name: s.name, strategy: s.strategy, state: "connecting", timeframe: s.timeframe,
        profit: { closedProfit: 0, closedProfitPct: 0, closedTradeCount: 0, winningTrades: 0, losingTrades: 0, bestPair: "—" },
      })),
      aggregate: { totalProfit: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, openPositions: 0, botsOnline: 0, botsTotal: 5, equity: 10000, exchange: "binance", dryRun: true, activeStrategy: "—" },
      openTrades: [],
      balance: null,
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
