import type {
  IntelligenceSignal,
  LunarCrushTopic,
  LunarCrushTimeSeries,
} from "@/types/intelligence";

const LUNARCRUSH_BASE = "https://lunarcrush.com/api4/public";
const API_KEY = process.env.LUNARCRUSH_API_KEY || "";

async function lcFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${LUNARCRUSH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
    next: { revalidate: 300 }, // cache 5 min
  });
  if (!res.ok) {
    throw new Error(`LunarCrush API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export class LunarCrushIntelligence {
  async getTopic(symbol: string): Promise<LunarCrushTopic> {
    const data = await lcFetch<{ data: LunarCrushTopic }>(
      `/topic/${symbol.toLowerCase()}`
    );
    return data.data;
  }

  async getTimeSeries(
    symbol: string,
    interval: "1w" | "1m" | "3m" | "6m" | "1y" = "1w"
  ): Promise<LunarCrushTimeSeries[]> {
    const data = await lcFetch<{ data: LunarCrushTimeSeries[] }>(
      `/topic/${symbol.toLowerCase()}/time-series?interval=${interval}`
    );
    return data.data;
  }

  async getTopPosts(symbol: string, limit = 20) {
    const data = await lcFetch<{ data: LunarCrushPost[] }>(
      `/topic/${symbol.toLowerCase()}/posts?limit=${limit}`
    );
    return data.data;
  }

  async getCryptoList() {
    const data = await lcFetch<{ data: LunarCrushTopic[] }>(
      "/coins/list"
    );
    return data.data;
  }

  async searchTopics(query: string) {
    const data = await lcFetch<{ data: LunarCrushTopic[] }>(
      `/search?q=${encodeURIComponent(query)}`
    );
    return data.data;
  }

  // Generate trading intelligence signal
  async getTradeSignal(symbol: string): Promise<IntelligenceSignal> {
    const topic = await this.getTopic(symbol);
    const timeSeries = await this.getTimeSeries(symbol, "1w");
    const posts = await this.getTopPosts(symbol, 50);

    const socialMomentum = this.calculateMomentum(timeSeries);
    const sentimentBias = this.classifySentiment(posts);
    const confidence = this.computeConfidence(topic, socialMomentum, sentimentBias);

    return {
      symbol,
      galaxyScore: topic.galaxy_score || 0,
      altRank: topic.alt_rank || 0,
      socialMomentum,
      sentimentBias,
      confidence,
      recommendation: this.generateRecommendation(topic.galaxy_score, confidence, sentimentBias),
      socialVolume: topic.social_volume || 0,
      socialDominance: topic.social_dominance || 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Entry filter: only trade when social conditions are favorable
  shouldEnterTrade(signal: IntelligenceSignal): boolean {
    return (
      signal.galaxyScore >= 65 &&
      signal.socialMomentum > 0 &&
      signal.sentimentBias > 0.2 &&
      signal.confidence >= 0.6
    );
  }

  // Position size multiplier based on social conviction
  getPositionSizeMultiplier(signal: IntelligenceSignal): number {
    if (signal.galaxyScore >= 80 && signal.confidence >= 0.8) return 1.5;
    if (signal.galaxyScore >= 70 && signal.confidence >= 0.7) return 1.2;
    if (signal.galaxyScore >= 60 && signal.confidence >= 0.6) return 1.0;
    return 0.5;
  }

  private calculateMomentum(timeSeries: LunarCrushTimeSeries[]): number {
    if (timeSeries.length < 2) return 0;
    const recent = timeSeries.slice(-3);
    const older = timeSeries.slice(-6, -3);
    const recentAvg = recent.reduce((s, d) => s + (d.social_volume || 0), 0) / recent.length;
    const olderAvg = older.length > 0
      ? older.reduce((s, d) => s + (d.social_volume || 0), 0) / older.length
      : recentAvg;
    if (olderAvg === 0) return 0;
    return (recentAvg - olderAvg) / olderAvg;
  }

  private classifySentiment(posts: LunarCrushPost[]): number {
    if (posts.length === 0) return 0;
    let bullish = 0;
    let bearish = 0;
    for (const post of posts) {
      if (post.sentiment && post.sentiment > 0) bullish++;
      else if (post.sentiment && post.sentiment < 0) bearish++;
    }
    const total = bullish + bearish;
    if (total === 0) return 0;
    return (bullish - bearish) / total; // -1 to 1
  }

  private computeConfidence(
    topic: LunarCrushTopic,
    momentum: number,
    sentiment: number
  ): number {
    let confidence = 0;
    // Galaxy score weight (0-0.4)
    confidence += Math.min((topic.galaxy_score || 0) / 100, 1) * 0.4;
    // Momentum weight (0-0.3)
    confidence += Math.min(Math.max(momentum + 0.5, 0), 1) * 0.3;
    // Sentiment weight (0-0.3)
    confidence += Math.min(Math.max((sentiment + 1) / 2, 0), 1) * 0.3;
    return Math.round(confidence * 100) / 100;
  }

  private generateRecommendation(
    galaxyScore: number,
    confidence: number,
    sentimentBias: number
  ): IntelligenceSignal["recommendation"] {
    const score = galaxyScore * 0.4 + confidence * 100 * 0.3 + (sentimentBias + 1) * 50 * 0.3;
    if (score >= 80) return "STRONG_BUY";
    if (score >= 65) return "BUY";
    if (score >= 40) return "NEUTRAL";
    if (score >= 25) return "SELL";
    return "STRONG_SELL";
  }
}

interface LunarCrushPost {
  id: string;
  text: string;
  sentiment: number;
  interactions: number;
  creator?: { name: string; followers: number };
}

export const lunarcrush = new LunarCrushIntelligence();
