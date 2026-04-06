"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  DollarSign,
  Activity,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { KPIData } from "@/types/trading";

interface KPICardsProps {
  data: KPIData;
}

export function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      title: "Total P&L",
      value: formatCurrency(data.totalPnl),
      change: formatPercent(data.dailyPnl),
      positive: data.totalPnl >= 0,
      icon: data.totalPnl >= 0 ? TrendingUp : TrendingDown,
    },
    {
      title: "Win Rate",
      value: `${data.winRate.toFixed(1)}%`,
      change: `${data.totalTrades} trades`,
      positive: data.winRate >= 55,
      icon: Target,
    },
    {
      title: "Equity",
      value: formatCurrency(data.equity),
      change: formatPercent(data.drawdown * -1),
      positive: data.drawdown < 10,
      icon: DollarSign,
    },
    {
      title: "Open Positions",
      value: data.openPositions.toString(),
      change: data.openPositions <= 3 ? "Within limit" : "At max",
      positive: data.openPositions <= 3,
      icon: Activity,
    },
    {
      title: "Drawdown",
      value: formatPercent(data.drawdown * -1),
      change: data.drawdown > 15 ? "HALT ZONE" : data.drawdown > 10 ? "Caution" : "Healthy",
      positive: data.drawdown < 10,
      icon: AlertTriangle,
    },
    {
      title: "Sharpe Ratio",
      value: data.sharpeRatio.toFixed(2),
      change: data.sharpeRatio >= 1.5 ? "Excellent" : data.sharpeRatio >= 1 ? "Good" : "Low",
      positive: data.sharpeRatio >= 1,
      icon: Zap,
    },
    {
      title: "Daily P&L",
      value: formatCurrency(data.dailyPnl),
      change: "Today",
      positive: data.dailyPnl >= 0,
      icon: BarChart3,
    },
    {
      title: "Total Trades",
      value: data.totalTrades.toString(),
      change: "All time",
      positive: true,
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {card.title}
            </CardTitle>
            <card.icon
              className={`h-4 w-4 ${card.positive ? "text-emerald-500" : "text-red-500"}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                card.positive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {card.value}
            </div>
            <p className="text-xs text-zinc-500 mt-1">{card.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
