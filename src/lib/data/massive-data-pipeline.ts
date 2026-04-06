import { lunarcrush } from "@/lib/api/lunarcrush-client";
import { freqtradeClient } from "@/lib/api/freqtrade-client";
import type { IntelligenceSignal } from "@/types/intelligence";

// In-memory cache for hot data
const cache = new Map<string, { data: unknown; expiry: number }>();

function setCache(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiry < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export interface AggregatedSignal {
  symbol: string;
  price: number;
  priceChange24h: number;
  intelligence: IntelligenceSignal;
  regime: string;
  overallScore: number; // 0-100 composite
  shouldTrade: boolean;
  positionSizeMultiplier: number;
  timestamp: string;
}

export class MassiveDataPipeline {
  private symbols: string[];

  constructor(symbols: string[] = ["BTC", "ETH", "SOL", "BNB"]) {
    this.symbols = symbols;
  }

  /**
   * Get aggregated signal for a single symbol
   */
  async getAggregatedSignal(symbol: string): Promise<AggregatedSignal> {
    const cacheKey = `signal:${symbol}`;
    const cached = getCache<AggregatedSignal>(cacheKey);
    if (cached) return cached;

    const intelligence = await lunarcrush.getTradeSignal(symbol);

    const signal: AggregatedSignal = {
      symbol,
      price: 0, // filled from exchange data
      priceChange24h: 0,
      intelligence,
      regime: "LOW_CONFIDENCE",
      overallScore: this.computeOverallScore(intelligence),
      shouldTrade: lunarcrush.shouldEnterTrade(intelligence),
      positionSizeMultiplier: lunarcrush.getPositionSizeMultiplier(intelligence),
      timestamp: new Date().toISOString(),
    };

    setCache(cacheKey, signal, 300); // 5 min cache
    return signal;
  }

  /**
   * Get signals for all tracked symbols
   */
  async getAllSignals(): Promise<AggregatedSignal[]> {
    const results = await Promise.allSettled(
      this.symbols.map((s) => this.getAggregatedSignal(s))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<AggregatedSignal> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  /**
   * Get dashboard overview combining Freqtrade + intelligence data
   */
  async getDashboardData() {
    const cacheKey = "dashboard";
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const [signals, profit, balance] = await Promise.allSettled([
      this.getAllSignals(),
      freqtradeClient.getProfit().catch(() => null),
      freqtradeClient.getBalance().catch(() => null),
    ]);

    const data = {
      signals: signals.status === "fulfilled" ? signals.value : [],
      profit: profit.status === "fulfilled" ? profit.value : null,
      balance: balance.status === "fulfilled" ? balance.value : null,
      timestamp: new Date().toISOString(),
    };

    setCache(cacheKey, data, 60); // 1 min cache
    return data;
  }

  private computeOverallScore(signal: IntelligenceSignal): number {
    // Weighted composite: Galaxy Score (40%), Confidence (30%), Sentiment (30%)
    const galaxyNorm = Math.min(signal.galaxyScore, 100);
    const confNorm = signal.confidence * 100;
    const sentNorm = ((signal.sentimentBias + 1) / 2) * 100; // -1..1 → 0..100

    return Math.round(galaxyNorm * 0.4 + confNorm * 0.3 + sentNorm * 0.3);
  }
}

export const dataPipeline = new MassiveDataPipeline();
