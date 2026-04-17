"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Play, Loader2, TrendingUp, TrendingDown, Target, AlertTriangle, Activity, DollarSign } from "lucide-react";

// Shape of freqtrade's backtest JSON — only the fields we actually render.
interface PairResult {
  key: string;
  trades: number;
  profit_total: number;          // ratio
  profit_total_pct: number;      // ratio-as-percent (freqtrade oddity)
  profit_total_abs: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  duration_avg: string;
  max_drawdown_account: number;
}

interface ExitReasonRow {
  exit_reason: string;
  trades: number;
  wins: number;
  losses: number;
  draws: number;
  profit_mean: number;
  profit_total_abs: number;
  profit_total: number;
}

interface StrategyResult {
  total_trades: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  profit_total: number;        // ratio (0.12 = +12%)
  profit_total_abs: number;    // absolute USDT
  starting_balance: number;
  final_balance: number;
  max_drawdown_account: number; // ratio
  max_drawdown_abs: number;
  sharpe: number;
  sortino: number;
  profit_factor: number;
  expectancy: number;
  trades_per_day: number;
  backtest_start: string;
  backtest_end: string;
  backtest_days: number;
  timeframe: string;
  stake_currency: string;
  results_per_pair: PairResult[];
  exit_reason_summary?: ExitReasonRow[];
}

interface BacktestResultEnvelope {
  strategy?: Record<string, StrategyResult>;
  error?: string;
}

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
  const [result, setResult] = useState<BacktestResultEnvelope | null>(null);

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
          setResult((data.backtest_result as BacktestResultEnvelope) ?? null);
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
      setResult({ error: err instanceof Error ? err.message : "Backtest failed" } as BacktestResultEnvelope);
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

      {result && <ResultsPanel result={result} strategyKey={strategy} />}

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

function fmtPct(v: number | undefined, digits = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtNum(v: number | undefined, digits = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}
function fmtMoney(v: number | undefined, currency = "USDT"): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toFixed(2)} ${currency}`;
}

function Stat({ label, value, sub, tone = "neutral", icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-zinc-100";
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500 tabular-nums">{sub}</div>}
    </div>
  );
}

function ResultsPanel({
  result,
  strategyKey,
}: {
  result: BacktestResultEnvelope;
  strategyKey: string;
}) {
  if (result.error) {
    return (
      <Card className="bg-zinc-900 border-rose-900/50">
        <CardHeader>
          <CardTitle className="text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Backtest error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-zinc-950 p-4 rounded-lg text-xs text-rose-200 overflow-auto">{result.error}</pre>
        </CardContent>
      </Card>
    );
  }

  // Freqtrade keys the result by strategy class name; fall back to first key.
  const strategies = result.strategy ?? {};
  const picked =
    strategies[strategyKey] ??
    (Object.values(strategies)[0] as StrategyResult | undefined);

  if (!picked) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Backtest Results</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          No strategy results returned — the webserver finished but the payload was empty.
        </CardContent>
      </Card>
    );
  }

  const s = picked;
  const profitTone = s.profit_total > 0 ? "good" : s.profit_total < 0 ? "bad" : "neutral";
  const ddTone = s.max_drawdown_account > 0.1 ? "bad" : s.max_drawdown_account > 0 ? "neutral" : "neutral";
  const empty = s.total_trades === 0;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center justify-between">
            <span>Backtest Results</span>
            <span className="text-xs font-normal text-zinc-500 tabular-nums">
              {s.backtest_start?.slice(0, 10)} → {s.backtest_end?.slice(0, 10)} · {s.backtest_days}d · {s.timeframe}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {empty && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
              <div className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> 0 trades generated
              </div>
              <p className="mt-1 text-amber-300/80">
                The strategy didn&apos;t fire any entry signals on this timeframe/timerange. Try a wider timerange, a shorter timeframe (1h/15m), or a different strategy. The run itself succeeded.
              </p>
            </div>
          )}

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Stat
              label="Total trades"
              value={String(s.total_trades)}
              sub={`${fmtNum(s.trades_per_day, 2)}/day`}
              icon={Activity}
            />
            <Stat
              label="Win rate"
              value={fmtPct(s.winrate, 1)}
              sub={`${s.wins}W / ${s.losses}L / ${s.draws}D`}
              tone={s.winrate >= 0.5 ? "good" : s.winrate > 0 ? "neutral" : "neutral"}
              icon={Target}
            />
            <Stat
              label="Total profit"
              value={fmtPct(s.profit_total, 2)}
              sub={fmtMoney(s.profit_total_abs, s.stake_currency)}
              tone={profitTone}
              icon={s.profit_total >= 0 ? TrendingUp : TrendingDown}
            />
            <Stat
              label="Final balance"
              value={fmtMoney(s.final_balance, s.stake_currency)}
              sub={`from ${fmtMoney(s.starting_balance, s.stake_currency)}`}
              icon={DollarSign}
            />
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <Stat label="Max drawdown" value={fmtPct(s.max_drawdown_account, 2)} sub={fmtMoney(s.max_drawdown_abs, s.stake_currency)} tone={ddTone} />
            <Stat label="Sharpe" value={fmtNum(s.sharpe, 2)} tone={s.sharpe > 1 ? "good" : s.sharpe < 0 ? "bad" : "neutral"} />
            <Stat label="Sortino" value={fmtNum(s.sortino, 2)} tone={s.sortino > 1 ? "good" : s.sortino < 0 ? "bad" : "neutral"} />
            <Stat label="Profit factor" value={fmtNum(s.profit_factor, 2)} tone={s.profit_factor > 1 ? "good" : s.profit_factor > 0 ? "bad" : "neutral"} />
            <Stat label="Expectancy" value={fmtNum(s.expectancy, 3)} tone={s.expectancy > 0 ? "good" : s.expectancy < 0 ? "bad" : "neutral"} />
          </div>
        </CardContent>
      </Card>

      {s.results_per_pair && s.results_per_pair.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Per-pair performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-4">Pair</th>
                    <th className="py-2 pr-4 text-right">Trades</th>
                    <th className="py-2 pr-4 text-right">Win rate</th>
                    <th className="py-2 pr-4 text-right">Avg dur</th>
                    <th className="py-2 pr-4 text-right">Profit %</th>
                    <th className="py-2 pr-4 text-right">Profit {s.stake_currency}</th>
                    <th className="py-2 pr-4 text-right">Max DD</th>
                  </tr>
                </thead>
                <tbody>
                  {s.results_per_pair.map((p) => {
                    const isTotal = p.key === "TOTAL";
                    const rowCls = isTotal
                      ? "border-t-2 border-zinc-700 font-semibold text-zinc-100"
                      : "border-b border-zinc-900/60 text-zinc-300";
                    const profitCls =
                      p.profit_total > 0 ? "text-emerald-400" : p.profit_total < 0 ? "text-rose-400" : "text-zinc-500";
                    return (
                      <tr key={p.key} className={rowCls}>
                        <td className="py-2 pr-4">{p.key}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{p.trades}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{p.trades > 0 ? fmtPct(p.winrate, 1) : "—"}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{p.duration_avg || "—"}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${profitCls}`}>{fmtPct(p.profit_total, 2)}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${profitCls}`}>{fmtMoney(p.profit_total_abs, s.stake_currency)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{fmtPct(p.max_drawdown_account, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {s.exit_reason_summary && s.exit_reason_summary.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Exit reason breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4 text-right">Trades</th>
                    <th className="py-2 pr-4 text-right">W / L / D</th>
                    <th className="py-2 pr-4 text-right">Avg profit %</th>
                    <th className="py-2 pr-4 text-right">Total {s.stake_currency}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.exit_reason_summary.map((r) => {
                    const profitCls = r.profit_total > 0 ? "text-emerald-400" : r.profit_total < 0 ? "text-rose-400" : "text-zinc-500";
                    return (
                      <tr key={r.exit_reason} className="border-b border-zinc-900/60 text-zinc-300">
                        <td className="py-2 pr-4">{r.exit_reason}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{r.trades}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-zinc-400">{r.wins}/{r.losses}/{r.draws}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${profitCls}`}>{fmtPct(r.profit_mean, 2)}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${profitCls}`}>{fmtMoney(r.profit_total_abs, s.stake_currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
