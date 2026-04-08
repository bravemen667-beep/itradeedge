import { NextResponse } from "next/server";

const VPS_IP = "46.202.141.42";
const FT_USER = process.env.FREQTRADE_API_USER || "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "";

const BOTS = [
  { name: "BabybotTrend", port: 8080, strategy: "BabybotTrend99Imperial" },
  { name: "MiesseMultiFactor", port: 8081, strategy: "MiesseMultiFactor99Imperial" },
  { name: "EMAScalping", port: 8082, strategy: "EMAScalping99Imperial" },
  { name: "TrendFollowing", port: 8083, strategy: "TrendFollowing99Imperial" },
  { name: "DaveyBreakout", port: 8084, strategy: "DaveyBreakout99Imperial" },
];

async function ftFetch(port: number, path: string) {
  const encoded = Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64");
  const res = await fetch(`http://${VPS_IP}:${port}/api/v1${path}`, {
    headers: { Authorization: `Basic ${encoded}` },
    next: { revalidate: 15 },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function GET() {
  const results = await Promise.allSettled(
    BOTS.map(async (bot) => {
      const [config, profit, openTrades, balance] = await Promise.allSettled([
        ftFetch(bot.port, "/show_config"),
        ftFetch(bot.port, "/profit"),
        ftFetch(bot.port, "/status"),
        ftFetch(bot.port, "/balance"),
      ]);

      return {
        name: bot.name,
        strategy: bot.strategy,
        port: bot.port,
        state:
          config.status === "fulfilled" ? config.value.state : "offline",
        timeframe:
          config.status === "fulfilled" ? config.value.timeframe : "?",
        dryRun:
          config.status === "fulfilled" ? config.value.dry_run : true,
        profit:
          profit.status === "fulfilled"
            ? {
                totalProfit: profit.value.profit_all_coin || 0,
                totalProfitPct: profit.value.profit_all_percent || 0,
                closedProfit: profit.value.profit_closed_coin || 0,
                closedProfitPct: profit.value.profit_closed_percent || 0,
                tradeCount: profit.value.trade_count || 0,
                closedTradeCount: profit.value.closed_trade_count || 0,
                winningTrades: profit.value.winning_trades || 0,
                losingTrades: profit.value.losing_trades || 0,
                avgDuration: profit.value.avg_duration || "0:00",
                bestPair: profit.value.best_pair || "",
              }
            : null,
        openTrades:
          openTrades.status === "fulfilled"
            ? (openTrades.value as Array<Record<string, unknown>>).map((t) => ({
                pair: t.pair,
                side: t.is_short ? "SHORT" : "LONG",
                openRate: t.open_rate,
                currentRate: t.close_rate || t.open_rate,
                profitAbs: t.profit_abs || 0,
                profitPct: (t.profit_ratio as number) * 100 || 0,
                strategy: t.strategy,
                openDate: t.open_date,
              }))
            : [],
        balance:
          balance.status === "fulfilled"
            ? { total: balance.value.total || 0, currencies: balance.value.currencies || [] }
            : null,
      };
    })
  );

  const bots = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Record<string, unknown>>).value);

  // Aggregate KPIs
  let totalProfit = 0;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  const allOpenTrades: unknown[] = [];

  for (const bot of bots) {
    const p = bot.profit as Record<string, number> | null;
    if (p) {
      totalProfit += p.closedProfit || 0;
      totalTrades += (p.closedTradeCount || 0);
      winningTrades += (p.winningTrades || 0);
      losingTrades += (p.losingTrades || 0);
    }
    const ot = bot.openTrades as unknown[];
    if (ot) allOpenTrades.push(...ot);
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  return NextResponse.json({
    bots,
    aggregate: {
      totalProfit,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      openPositions: allOpenTrades.length,
      botsOnline: bots.filter((b) => b.state === "running").length,
      botsTotal: BOTS.length,
    },
    openTrades: allOpenTrades,
    timestamp: new Date().toISOString(),
  });
}
