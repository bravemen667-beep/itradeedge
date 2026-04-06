"use client";

import { useEffect, useState } from "react";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { EquityCurve } from "@/components/charts/equity-curve";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { SignalCard } from "@/components/intelligence/signal-card";
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
  const [equity, setEquity] = useState<EquityPoint[]>(demoEquity);
  const [signals, setSignals] = useState<IntelligenceSignal[]>(demoSignals);

  useEffect(() => {
    // Fetch live data when APIs are connected
    async function fetchData() {
      try {
        const [perfRes, signalRes] = await Promise.allSettled([
          fetch("/api/performance"),
          fetch("/api/intelligence/signals"),
        ]);

        if (perfRes.status === "fulfilled" && perfRes.value.ok) {
          const perf = await perfRes.value.json();
          if (perf.summary) {
            setKpi((prev) => ({
              ...prev,
              totalPnl: perf.summary.totalProfit,
              winRate: perf.summary.winRate,
              totalTrades: perf.summary.totalTrades,
            }));
          }
          if (perf.equityCurve?.length) setEquity(perf.equityCurve);
        }

        if (signalRes.status === "fulfilled" && signalRes.value.ok) {
          const data = await signalRes.value.json();
          if (data.signals?.length) {
            setSignals(
              data.signals.map(
                (s: { intelligence: IntelligenceSignal }) => s.intelligence
              )
            );
          }
        }
      } catch {
        // Use demo data on error
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
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
    </div>
  );
}
