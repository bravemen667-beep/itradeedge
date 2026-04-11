import { NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

// Each strategy maps to a bot instance reachable via the per-bot proxy route
// /bot/<name>/<path>. The proxy fans these out to the matching freqtrade
// container on the VPS (babybot:8080, miesse:8081, ema:8082, trend:8083,
// davey:8084). Adding a new bot here = one row in this array.
interface BotSpec {
  name: string;          // dashboard display name
  proxyName: string;     // segment used in /bot/<proxyName>/...
  strategy: string;      // freqtrade strategy class
  timeframe: string;     // for the dashboard pill
}

const ALL_BOTS: BotSpec[] = [
  { name: "BabybotTrend",      proxyName: "babybot", strategy: "BabybotTrend99Imperial",      timeframe: "4h" },
  { name: "MiesseMultiFactor", proxyName: "miesse",  strategy: "MiesseMultiFactor99Imperial", timeframe: "1h" },
  { name: "EMAScalping",       proxyName: "ema",     strategy: "EMAScalping99Imperial",       timeframe: "1m" },
  { name: "TrendFollowing",    proxyName: "trend",   strategy: "TrendFollowing99Imperial",    timeframe: "15m" },
  { name: "DaveyBreakout",     proxyName: "davey",   strategy: "DaveyBreakout99Imperial",     timeframe: "1h" },
];

interface FTConfig { strategy?: string; state?: string; runmode?: string; dry_run?: boolean; exchange?: string }
interface FTProfit {
  profit_closed_coin?: number;
  profit_factor?: number;
  closed_trade_count?: number;
  winning_trades?: number;
  losing_trades?: number;
  best_pair?: string;
}
interface FTTrade {
  trade_id: number;
  pair: string;
  is_short: boolean;
  open_rate: number;
  close_rate: number | null;
  profit_abs: number;
  profit_ratio: number;
  strategy: string;
  open_date: string;
  stake_amount: number;
}
interface FTBalance {
  total: number;
  currencies: { currency: string; free: number; balance: number; used: number }[];
}

// Per-bot snapshot. We fetch /show_config + /profit + /status concurrently
// for each bot and tolerate individual failures via Promise.allSettled so a
// single dead bot doesn't black out the whole dashboard.
async function getBotSnapshot(spec: BotSpec) {
  const base = `/bot/${spec.proxyName}`;
  const [cfgR, prfR, stsR] = await Promise.allSettled([
    ftProxy<FTConfig>(`${base}/show_config`),
    ftProxy<FTProfit>(`${base}/profit`),
    ftProxy<FTTrade[]>(`${base}/status`),
  ]);
  const cfg = cfgR.status === "fulfilled" ? cfgR.value : null;
  const prf = prfR.status === "fulfilled" ? prfR.value : null;
  const trades = stsR.status === "fulfilled" ? stsR.value : [];
  return { spec, cfg, prf, trades, online: cfg !== null || prf !== null };
}

export async function GET() {
  try {
    // Pull every bot in parallel + the babybot balance once for the equity
    // baseline (all 5 share the same dry_run wallet starting value).
    const snapshots = await Promise.all(ALL_BOTS.map(getBotSnapshot));
    const balanceR = await ftProxy<FTBalance>("/bot/babybot/balance").catch(() => null);

    // Build the per-bot rows for the strategy table. Each row gets its OWN
    // P&L numbers (the previous code only ever had numbers for the active
    // strategy and zero-stubbed the rest).
    const bots = snapshots.map(({ spec, prf, online }) => ({
      name: spec.name,
      strategy: spec.strategy,
      state: online ? "running" : "offline",
      timeframe: spec.timeframe,
      profit: {
        closedProfit: prf?.profit_closed_coin ?? 0,
        closedTradeCount: prf?.closed_trade_count ?? 0,
        winningTrades: prf?.winning_trades ?? 0,
        losingTrades: prf?.losing_trades ?? 0,
        bestPair: prf?.best_pair ?? "—",
      },
    }));

    // Aggregate across all bots for the dashboard KPI cards.
    const totalProfit = snapshots.reduce((sum, s) => sum + (s.prf?.profit_closed_coin ?? 0), 0);
    const totalTrades = snapshots.reduce((sum, s) => sum + (s.prf?.closed_trade_count ?? 0), 0);
    const winningTrades = snapshots.reduce((sum, s) => sum + (s.prf?.winning_trades ?? 0), 0);
    const losingTrades = snapshots.reduce((sum, s) => sum + (s.prf?.losing_trades ?? 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const botsOnline = snapshots.filter((s) => s.online).length;

    // Flatten every bot's open trades into one list. Use composite IDs that
    // include the proxy name so trade IDs from different bots don't collide
    // (each bot has its own trade_id sequence starting at 1).
    const openTrades = snapshots.flatMap(({ spec, trades }) =>
      trades.map((t) => ({
        id: `${spec.proxyName}-${t.trade_id}`,
        pair: t.pair,
        side: t.is_short ? "SHORT" : "LONG",
        openRate: t.open_rate,
        currentRate: t.close_rate ?? t.open_rate,
        profitAbs: t.profit_abs,
        profitPct: t.profit_ratio * 100,
        strategy: t.strategy,
        openDate: t.open_date,
        stakeAmount: t.stake_amount,
        bot: spec.name,
      }))
    );

    // Pull a representative config for the exchange/dry_run flags. babybot is
    // the canonical source — they all share the same exchange config anyway.
    const repCfg = snapshots.find((s) => s.cfg)?.cfg ?? null;
    const baseEquity = balanceR?.total ?? 10000;

    return NextResponse.json({
      bots,
      aggregate: {
        totalProfit,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        openPositions: openTrades.length,
        botsOnline,
        botsTotal: ALL_BOTS.length,
        equity: baseEquity + totalProfit,
        exchange: repCfg?.exchange ?? "binance",
        dryRun: repCfg?.dry_run ?? true,
        activeStrategy: repCfg?.strategy ?? null,
      },
      openTrades,
      balance: balanceR,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      bots: ALL_BOTS.map((s) => ({
        name: s.name,
        strategy: s.strategy,
        state: "offline",
        timeframe: s.timeframe,
        profit: { closedProfit: 0, closedTradeCount: 0, winningTrades: 0, losingTrades: 0, bestPair: "—" },
      })),
      aggregate: {
        totalProfit: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        openPositions: 0,
        botsOnline: 0,
        botsTotal: ALL_BOTS.length,
        equity: 10000,
      },
      openTrades: [],
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
