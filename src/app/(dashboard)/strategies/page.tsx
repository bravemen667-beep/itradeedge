"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Strategy } from "@/types/strategies";

const demoStrategies: Strategy[] = [
  {
    id: "1",
    name: "Trend Following",
    type: "TREND_FOLLOWING",
    enabled: true,
    description: "EMA 9/21 crossover + ADX > 25 + MACD confirmation. Galaxy Score > 65 filter.",
    parameters: { emaFast: 9, emaSlow: 21, adxThreshold: 25, stopLoss: 2.5, takeProfit: 5, timeframe: "15m" },
    winRate: 62.5,
    totalTrades: 80,
    profitFactor: 1.95,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Mean Reversion",
    type: "MEAN_REVERSION",
    enabled: true,
    description: "RSI oversold/overbought + Bollinger Band touch. RANGING regime only.",
    parameters: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70, bbPeriod: 20, bbStdDev: 2, stopLoss: 1.5, takeProfit: 3 },
    winRate: 68.3,
    totalTrades: 60,
    profitFactor: 1.72,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Grid Trading",
    type: "GRID",
    enabled: false,
    description: "ATR-based grid spacing. Galaxy Score 40-60 stability filter. Auto-pause on sentiment spikes.",
    parameters: { gridLevels: 10, gridSpacing: 0.5, gridAmount: 50, stopLoss: 3 },
    winRate: 58.7,
    totalTrades: 47,
    profitFactor: 1.45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "ML Ensemble",
    type: "ML_ENSEMBLE",
    enabled: false,
    description: "XGBoost on price + social features. Weekly retraining on 90-day rolling window. Phase 3.",
    parameters: { maxOpenTrades: 2, stopLoss: 2, takeProfit: 4 },
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "5",
    name: "EMA Scalping",
    type: "EMA_SCALPING",
    enabled: true,
    description: "1m EMA 9/50/150/200 + RSI < 40 + HH structure + 15m trend filter. 1:2 R:R, trailing SL to breakeven at 1:1.",
    parameters: { emaFast: 9, emaMedium: 50, emaSlow: 150, emaMajor: 200, rsiOversold: 40, stopLoss: 1, takeProfit: 2, timeframe: "1m" },
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

type BadgeVariant = "success" | "warning" | "secondary" | "default" | "destructive";

const typeColors: Record<string, BadgeVariant> = {
  TREND_FOLLOWING: "success",
  MEAN_REVERSION: "warning",
  GRID: "secondary",
  ML_ENSEMBLE: "default",
  EMA_SCALPING: "success",
  BREAKOUT: "success",
  REVERSAL: "warning",
  RISK_MGMT: "destructive",
  SENTIMENT: "default",
  MULTI_FACTOR: "secondary",
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>(demoStrategies);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/strategies", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) setStrategies(data);
      })
      .catch((err) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        console.error("[strategies] failed to load /api/strategies:", err);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const toggleStrategy = async (id: string, enabled: boolean) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s))
    );
    try {
      const res = await fetch("/api/strategies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[strategies] failed to toggle strategy:", err);
      // Revert on error
      setStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s))
      );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-100">Strategies</h2>
          <p className="text-zinc-500 mt-1">Manage and monitor trading strategies</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          + New Strategy
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {strategies.map((strategy) => (
          <Card key={strategy.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-zinc-100">{strategy.name}</CardTitle>
                  <Badge variant={typeColors[strategy.type] ?? "default"}>
                    {strategy.type.replace("_", " ")}
                  </Badge>
                </div>
                <CardDescription className="text-zinc-500">
                  {strategy.description}
                </CardDescription>
              </div>
              <Switch
                checked={strategy.enabled}
                onCheckedChange={(checked) => toggleStrategy(strategy.id, checked)}
              />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-zinc-500">Win Rate</p>
                  <p className="text-lg font-bold text-zinc-200">
                    {strategy.winRate > 0 ? `${strategy.winRate.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Trades</p>
                  <p className="text-lg font-bold text-zinc-200">{strategy.totalTrades || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Profit Factor</p>
                  <p className="text-lg font-bold text-zinc-200">
                    {strategy.profitFactor > 0 ? strategy.profitFactor.toFixed(2) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(strategy.parameters).map(([key, value]) => (
                  <span
                    key={key}
                    className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
