"use client";

import { useEffect, useState } from "react";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { EquityCurve } from "@/components/charts/equity-curve";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SignalCard } from "@/components/intelligence/signal-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KPIData, Position, EquityPoint } from "@/types/trading";
import type { IntelligenceSignal } from "@/types/intelligence";

// Demo data for initial render before API is connected
const demoKPI: KPIData = {
  totalPnl: 1247.83,
  winRate: 64.2,
  totalTrades: 187,
  openPositions: 2,
  equity: 10247.83,
  drawdown: 4.3,
  sharpeRatio: 1.72,
  dailyPnl: 86.42,
};

const demoPositions: Position[] = [
  {
    id: "1",
    pair: "BTC/USDT",
    side: "BUY",
    entryPrice: 84250.0,
    currentPrice: 84890.0,
    amount: 0.012,
    unrealizedPnl: 7.68,
    unrealizedPnlPercent: 0.76,
    stopLoss: 82100.0,
    takeProfit: 88000.0,
    strategy: "Trend Following",
    entryTime: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "2",
    pair: "ETH/USDT",
    side: "BUY",
    entryPrice: 1825.0,
    currentPrice: 1842.0,
    amount: 0.5,
    unrealizedPnl: 8.5,
    unrealizedPnlPercent: 0.93,
    stopLoss: 1780.0,
    takeProfit: 1950.0,
    strategy: "Mean Reversion",
    entryTime: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
];

const demoEquity: EquityPoint[] = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(Date.now() - (29 - i) * 86400000).toISOString(),
  equity: 9000 + Math.random() * 200 + i * 45,
  drawdown: Math.random() * 5,
}));

const demoSignals: IntelligenceSignal[] = [
  {
    symbol: "BTC",
    galaxyScore: 78,
    altRank: 1,
    socialMomentum: 0.15,
    sentimentBias: 0.62,
    confidence: 0.82,
    recommendation: "BUY",
    socialVolume: 245000,
    socialDominance: 32.4,
    timestamp: new Date().toISOString(),
  },
  {
    symbol: "ETH",
    galaxyScore: 71,
    altRank: 2,
    socialMomentum: 0.08,
    sentimentBias: 0.45,
    confidence: 0.71,
    recommendation: "BUY",
    socialVolume: 128000,
    socialDominance: 18.2,
    timestamp: new Date().toISOString(),
  },
  {
    symbol: "SOL",
    galaxyScore: 83,
    altRank: 3,
    socialMomentum: 0.32,
    sentimentBias: 0.78,
    confidence: 0.88,
    recommendation: "STRONG_BUY",
    socialVolume: 95000,
    socialDominance: 8.7,
    timestamp: new Date().toISOString(),
  },
  {
    symbol: "BNB",
    galaxyScore: 52,
    altRank: 5,
    socialMomentum: -0.05,
    sentimentBias: 0.12,
    confidence: 0.48,
    recommendation: "NEUTRAL",
    socialVolume: 42000,
    socialDominance: 4.1,
    timestamp: new Date().toISOString(),
  },
];

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPIData>(demoKPI);
  const [positions, setPositions] = useState<Position[]>(demoPositions);
  const [equity] = useState<EquityPoint[]>(demoEquity);
  const [signals] = useState<IntelligenceSignal[]>(demoSignals);

  const [bots, setBots] = useState<
    { name: string; strategy: string; state: string; timeframe: string; profit: Record<string, number> | null; openTrades: Position[] }[]
  >([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch real Freqtrade data from all 5 bots
        const liveRes = await fetch("/api/live");
        if (liveRes.ok) {
          const live = await liveRes.json();

          // Update KPIs from real aggregated data
          if (live.aggregate) {
            setKpi({
              totalPnl: live.aggregate.totalProfit,
              winRate: live.aggregate.winRate,
              totalTrades: live.aggregate.totalTrades,
              openPositions: live.aggregate.openPositions,
              equity: 10000 + live.aggregate.totalProfit,
              drawdown: 0,
              sharpeRatio: 0,
              dailyPnl: live.aggregate.totalProfit,
            });
          }

          // Update positions from real open trades
          if (live.openTrades?.length) {
            setPositions(
              live.openTrades.map((t: Record<string, unknown>, i: number) => ({
                id: String(i),
                pair: t.pair as string,
                side: (t.side as string) || "BUY",
                entryPrice: t.openRate as number,
                currentPrice: t.currentRate as number,
                amount: 0,
                unrealizedPnl: t.profitAbs as number,
                unrealizedPnlPercent: t.profitPct as number,
                strategy: t.strategy as string,
                entryTime: t.openDate as string,
              }))
            );
          } else {
            setPositions([]);
          }

          // Store bot details
          if (live.bots) setBots(live.bots);
        }
      } catch {
        // Use demo data on error
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-100">Dashboard</h2>
        <p className="text-zinc-500 mt-1">Real-time trading overview</p>
      </div>

      <KPICards data={kpi} />

      <div className="grid gap-6 lg:grid-cols-2">
        <EquityCurve data={equity} />
        <div className="grid gap-4 grid-cols-2">
          {signals.map((sig) => (
            <SignalCard key={sig.symbol} signal={sig} />
          ))}
        </div>
      </div>

      <PositionsTable positions={positions} />

      {/* Live Strategy Bots Status */}
      {bots.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Strategy Bots ({bots.filter(b => b.state === "running").length}/{bots.length} Online)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="text-left py-2 px-2">Strategy</th>
                    <th className="text-left py-2 px-2">State</th>
                    <th className="text-left py-2 px-2">Timeframe</th>
                    <th className="text-right py-2 px-2">Trades</th>
                    <th className="text-right py-2 px-2">Wins</th>
                    <th className="text-right py-2 px-2">Profit</th>
                    <th className="text-right py-2 px-2">Best Pair</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((bot) => (
                    <tr key={bot.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="py-2 px-2 font-medium text-zinc-100">{bot.name}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${bot.state === "running" ? "text-emerald-400" : "text-red-400"}`}>
                          <span className={`h-2 w-2 rounded-full ${bot.state === "running" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                          {bot.state}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-zinc-400">{bot.timeframe}</td>
                      <td className="py-2 px-2 text-right text-zinc-300">
                        {bot.profit?.closedTradeCount ?? 0}
                      </td>
                      <td className="py-2 px-2 text-right text-zinc-300">
                        {bot.profit?.winningTrades ?? 0}
                      </td>
                      <td className={`py-2 px-2 text-right font-medium ${(bot.profit?.closedProfit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${(bot.profit?.closedProfit ?? 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right text-zinc-400">
                        {bot.profit?.bestPair ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
