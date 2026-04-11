"use client";

import { useEffect, useState } from "react";
import { PnlChart } from "@/components/charts/pnl-chart";
import { EquityCurve } from "@/components/charts/equity-curve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface PerformanceData {
  summary: {
    totalProfit: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgProfit: number;
  };
  dailyPnl: { date: string; pnl: number }[];
  pairPerformance: {
    pair: string;
    profit: number;
    count: number;
    wins: number;
    winRate: number;
  }[];
  strategyStats: {
    name: string;
    type: string;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
  }[];
  equityCurve: { timestamp: string; equity: number; drawdown: number }[];
}

const demoData: PerformanceData = {
  summary: {
    totalProfit: 1247.83,
    winRate: 64.2,
    profitFactor: 1.87,
    totalTrades: 187,
    avgProfit: 6.67,
  },
  dailyPnl: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
    pnl: (Math.random() - 0.35) * 80,
  })),
  pairPerformance: [
    { pair: "BTC/USDT", profit: 620.5, count: 65, wins: 42, winRate: 64.6 },
    { pair: "ETH/USDT", profit: 380.2, count: 52, wins: 34, winRate: 65.4 },
    { pair: "SOL/USDT", profit: 195.8, count: 42, wins: 28, winRate: 66.7 },
    { pair: "BNB/USDT", profit: 51.33, count: 28, wins: 16, winRate: 57.1 },
  ],
  strategyStats: [
    { name: "Trend Following", type: "TREND_FOLLOWING", winRate: 62.5, totalTrades: 80, profitFactor: 1.95 },
    { name: "Mean Reversion", type: "MEAN_REVERSION", winRate: 68.3, totalTrades: 60, profitFactor: 1.72 },
    { name: "Grid Trading", type: "GRID", winRate: 58.7, totalTrades: 47, profitFactor: 1.45 },
  ],
  equityCurve: Array.from({ length: 30 }, (_, i) => ({
    timestamp: new Date(Date.now() - (29 - i) * 86400000).toISOString(),
    equity: 9000 + Math.random() * 200 + i * 45,
    drawdown: Math.random() * 5,
  })),
};

export default function AnalyticsPage() {
  const [data, setData] = useState<PerformanceData>(demoData);

  useEffect(() => {
    fetch("/api/performance?days=30")
      .then((r) => r.json())
      .then((d) => { if (d.summary) setData(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-100">Analytics</h2>
        <p className="text-zinc-500 mt-1">Performance breakdown and metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: "Total P&L", value: formatCurrency(data.summary.totalProfit) },
          { label: "Win Rate", value: `${data.summary.winRate.toFixed(1)}%` },
          { label: "Profit Factor", value: data.summary.profitFactor.toFixed(2) },
          { label: "Total Trades", value: data.summary.totalTrades.toString() },
          { label: "Avg Profit", value: formatCurrency(data.summary.avgProfit) },
        ].map((item) => (
          <Card key={item.label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <p className="text-sm text-zinc-400">{item.label}</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EquityCurve data={data.equityCurve} />
        <PnlChart data={data.dailyPnl} />
      </div>

      {/* Pair Performance */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Pair Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="text-left py-3">Pair</th>
                <th className="text-right py-3">Profit</th>
                <th className="text-right py-3">Trades</th>
                <th className="text-right py-3">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.pairPerformance.map((p) => (
                <tr key={p.pair} className="border-b border-zinc-800/50">
                  <td className="py-3 font-medium text-zinc-100">{p.pair}</td>
                  <td className={`py-3 text-right ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(p.profit)}
                  </td>
                  <td className="py-3 text-right text-zinc-300">{p.count}</td>
                  <td className="py-3 text-right text-zinc-300">{p.winRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Strategy Performance */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Strategy Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="text-left py-3">Strategy</th>
                <th className="text-right py-3">Win Rate</th>
                <th className="text-right py-3">Trades</th>
                <th className="text-right py-3">Profit Factor</th>
              </tr>
            </thead>
            <tbody>
              {data.strategyStats.map((s) => (
                <tr key={s.name} className="border-b border-zinc-800/50">
                  <td className="py-3 font-medium text-zinc-100">{s.name}</td>
                  <td className="py-3 text-right text-zinc-300">{s.winRate.toFixed(1)}%</td>
                  <td className="py-3 text-right text-zinc-300">{s.totalTrades}</td>
                  <td className="py-3 text-right text-zinc-300">{s.profitFactor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
