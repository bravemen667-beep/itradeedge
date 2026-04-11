"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Play, Loader2 } from "lucide-react";

export default function BacktestPage() {
  const [strategy, setStrategy] = useState("TrendFollowing99Imperial");
  const [timeframe, setTimeframe] = useState("15m");
  const [timerange, setTimerange] = useState("20260101-20260401");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/freqtrade/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, timeframe, timerange }),
      });
      // Without this check a 500/502 from the proxy was being parsed as if it
      // were valid backtest output and rendered to the user as garbage JSON.
      if (!res.ok) {
        throw new Error(`Backtest request failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("[backtest] run failed:", err);
      setResult({ error: "Backtest failed — check Freqtrade connection" });
    }
    setRunning(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-cyan-400" />
          Backtesting
        </h2>
        <p className="text-zinc-500 mt-1">
          Test strategies against historical data via Freqtrade
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Configure Backtest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm"
              >
                <option value="TrendFollowing99Imperial">Trend Following</option>
                <option value="MeanReversion99Imperial">Mean Reversion</option>
                <option value="GridTrading99Imperial">Grid Trading</option>
                <option value="SentimentAdaptive99Imperial">Sentiment Adaptive</option>
                <option value="EMAScalping99Imperial">EMA Scalping (1m)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm"
              >
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="1d">1 day</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Time Range</label>
              <input
                type="text"
                value={timerange}
                onChange={(e) => setTimerange(e.target.value)}
                placeholder="20260101-20260401"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm"
              />
            </div>
          </div>

          <Button
            onClick={runBacktest}
            disabled={running}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {running ? "Running Backtest..." : "Run Backtest"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Backtest Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-zinc-950 p-4 rounded-lg text-sm text-zinc-300 overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Backtest info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">How Backtesting Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400 space-y-2">
          <p>Backtesting runs through Freqtrade&apos;s battle-tested engine on the VPS.</p>
          <p>1. Select a strategy and time range</p>
          <p>2. Freqtrade replays historical data and simulates trades</p>
          <p>3. Results include win rate, profit factor, drawdown, and trade-by-trade breakdown</p>
          <p>4. Use Freqtrade Hyperopt to automatically optimize parameters</p>
        </CardContent>
      </Card>
    </div>
  );
}
