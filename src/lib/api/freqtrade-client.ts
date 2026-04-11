const FREQTRADE_URL = process.env.FREQTRADE_API_URL || "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FREQTRADE_USER = process.env.FREQTRADE_API_USER || "freqtrader";
const FREQTRADE_PASS = process.env.FREQTRADE_API_PASS || "";

let _jwt: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (_jwt && _jwt.expires > Date.now()) return _jwt.token;
  const encoded = Buffer.from(`${FREQTRADE_USER}:${FREQTRADE_PASS}`).toString("base64");
  const res = await fetch(`${FREQTRADE_URL}/token/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${encoded}` },
  });
  if (!res.ok) throw new Error(`Freqtrade login failed: ${res.status}`);
  const data = await res.json();
  _jwt = { token: data.access_token, expires: Date.now() + 14 * 60 * 1000 };
  return data.access_token;
}

async function ftFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${FREQTRADE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Freqtrade API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const freqtradeClient = {
  // Status & Health
  async ping() {
    return ftFetch<{ status: string }>("/ping");
  },

  async version() {
    return ftFetch<{ version: string }>("/version");
  },

  async health() {
    return ftFetch<{ last_process: string; last_process_ts: number }>("/health");
  },

  // Trading
  async getOpenTrades() {
    return ftFetch<FreqtradeTrade[]>("/status");
  },

  async getClosedTrades(limit = 50) {
    return ftFetch<{ trades: FreqtradeTrade[]; trades_count: number }>(
      `/trades?limit=${limit}`
    );
  },

  async getProfit() {
    return ftFetch<FreqtradeProfit>("/profit");
  },

  async getBalance() {
    return ftFetch<FreqtradeBalance>("/balance");
  },

  // Strategy
  async getStrategy(name: string) {
    return ftFetch<{ strategy: string; code: string }>(`/strategy/${name}`);
  },

  async listStrategies() {
    return ftFetch<{ strategies: string[] }>("/strategies");
  },

  // Control
  async startTrading() {
    return ftFetch("/start", { method: "POST" });
  },

  async stopTrading() {
    return ftFetch("/stop", { method: "POST" });
  },

  async forceEntry(pair: string, side: "long" | "short" = "long") {
    return ftFetch("/forceenter", {
      method: "POST",
      body: JSON.stringify({ pair, side }),
    });
  },

  async forceExit(tradeId: number) {
    return ftFetch("/forceexit", {
      method: "POST",
      body: JSON.stringify({ tradeid: tradeId }),
    });
  },

  // Performance & Stats
  async getPerformance() {
    return ftFetch<FreqtradePerf[]>("/performance");
  },

  async getStats() {
    return ftFetch<FreqtradeStats>("/stats");
  },

  async getDailyStats(days = 30) {
    return ftFetch<{ data: FreqtradeDailyStats[] }>(`/daily?timescale=${days}`);
  },

  // Backtesting
  async startBacktest(config: BacktestConfig) {
    return ftFetch("/backtest", {
      method: "POST",
      body: JSON.stringify(config),
    });
  },

  async getBacktestResult() {
    return ftFetch("/backtest");
  },

  // Generic proxy for any Freqtrade endpoint
  async proxy(path: string, method = "GET", body?: unknown) {
    return ftFetch(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
  },
};

// Freqtrade types
export interface FreqtradeTrade {
  trade_id: number;
  pair: string;
  is_open: boolean;
  is_short: boolean;
  open_rate: number;
  close_rate: number | null;
  stake_amount: number;
  amount: number;
  profit_abs: number;
  profit_ratio: number;
  stop_loss_abs: number;
  open_date: string;
  close_date: string | null;
  strategy: string;
  timeframe: string;
}

export interface FreqtradeProfit {
  profit_all_coin: number;
  profit_all_percent: number;
  profit_closed_coin: number;
  profit_closed_percent: number;
  trade_count: number;
  closed_trade_count: number;
  winning_trades: number;
  losing_trades: number;
  avg_duration: string;
  best_pair: string;
  best_rate: number;
  profit_factor: number;
}

export interface FreqtradeBalance {
  currencies: { currency: string; free: number; balance: number; used: number }[];
  total: number;
  symbol: string;
  value: number;
}

export interface FreqtradePerf {
  pair: string;
  profit: number;
  count: number;
}

export interface FreqtradeStats {
  sell_reasons: Record<string, { wins: number; losses: number; draws: number }>;
  durations: Record<string, number>;
}

export interface FreqtradeDailyStats {
  date: string;
  abs_profit: number;
  rel_profit: number;
  trade_count: number;
}

export interface BacktestConfig {
  strategy: string;
  timeframe: string;
  timerange: string;
  max_open_trades?: number;
  stake_amount?: number;
  enable_protections?: boolean;
}
