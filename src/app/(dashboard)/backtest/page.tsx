"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Play, Loader2 } from "lucide-react";

// Freqtrade webserver-mode /api/v1/backtest is async: POST starts the run,
// GET polls status until { status: "ended" } and returns { backtest_result }.
// This page handles that whole lifecycle: start -> poll every 2s -> stop on
// terminal state (ended/error) or on a 5-minute hard timeout.

interface BacktestStatus {
  status: string;
  running: boolean;
  status_msg?: string;
  step?: string;
  progress?: number;
  trade_count?: number | null;
  backtest_result?: unknown;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 150 * 2s = 5 minutes

export default function BacktestPage() {
  const [strategy, setStrategy] = useState("BabybotTrend99Imperial");
  const [timeframe, setTimeframe] = useState("4h");
  const [timerange, setTimerange] = useState("20260101-20260201");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  // Track the in-flight poll loop so unmount can stop it cleanly.
  const cancelledRef = useRef(false);
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    setStatus("Starting backtest…");
    setProgress(0);
    cancelledRef.current = false;

    try {
      // 1. Kick off the backtest. freqtrade webserver mode requires the full
      //    parameter set even when most values come from config.json — the
      //    body validator is strict.
      const startRes = await fetch("/api/freqtrade/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          timeframe,
          timerange,
          enable_protections: false,
          max_open_trades: 3,
          stake_amount: "unlimited",
          starting_capital: 10000,
          dry_run_wallet: 10000,
        }),
      });
      if (!startRes.ok) {
        const errBody = await startRes.text().catch(() => "");
        throw new Error(`Start failed: HTTP ${startRes.status} ${errBody.slice(0, 200)}`);
      }

      // 2. Poll until terminal state or timeout.
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelledRef.current) return;
        await sleep(POLL_INTERVAL_MS);
        if (cancelledRef.current) return;

        const pollRes = await fetch("/api/freqtrade/backtest");
        if (!pollRes.ok) {
          throw new Error(`Poll failed: HTTP ${pollRes.status}`);
        }
        const data = (await pollRes.json()) as BacktestStatus;

        const pct = Math.round((data.progress ?? 0) * 100);
        setProgress(pct);
        setStatus(`${data.status_msg || data.status} — step: ${data.step || "…"} (${pct}%)`);

        if (data.status === "ended") {
          setResult((data.backtest_result as Record<string, unknown>) ?? data);
          setStatus("Backtest complete");
          return;
        }
        if (data.status === "error") {
          throw new Error(data.status_msg || "Backtest reported error state");
        }
      }
      throw new Error(`Backtest timed out after ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
    } catch (err) {
      console.error("[backtest] failed:", err);
      setResult({ error: err instanceof Error ? err.message : "Backtest failed" });
      setStatus("Failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-cyan-400" />
          Backtesting
        </h2>
        <p className="text-zinc-500 mt-1">
          Test strategies against historical data via Freqtrade webserver
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
                disabled={running}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm disabled:opacity-50"
              >
                <option value="BabybotTrend99Imperial">Babybot Trend</option>
                <option value="TrendFollowing99Imperial">Trend Following</option>
                <option value="MiesseMultiFactor99Imperial">Miesse Multi-Factor</option>
                <option value="EMAScalping99Imperial">EMA Scalping (1m)</option>
                <option value="DaveyBreakout99Imperial">Davey Breakout</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                disabled={running}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm disabled:opacity-50"
              >
                <option value="1m">1 minute</option>
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
                disabled={running}
                placeholder="20260101-20260401"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm disabled:opacity-50"
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
            {running ? "Running…" : "Run Backtest"}
          </Button>

          {(running || status) && (
            <div className="space-y-2">
              <div className="text-xs text-zinc-400">{status}</div>
              {running && (
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Backtest Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-zinc-950 p-4 rounded-lg text-xs text-zinc-300 overflow-auto max-h-[600px]">
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
          <p>Backtesting runs against a dedicated Freqtrade webserver instance on the VPS, separate from the live trading bots.</p>
          <p>1. Choose strategy, timeframe, and date range</p>
          <p>2. The webserver replays historical OHLCV data and simulates trades</p>
          <p>3. Results return when finished — usually within a few seconds for short ranges</p>
          <p>4. Long ranges or fresh data downloads can take longer; the page polls for up to 5 minutes</p>
        </CardContent>
      </Card>
    </div>
  );
}
