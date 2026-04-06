export interface IntelligenceSignal {
  symbol: string;
  galaxyScore: number;
  altRank: number;
  socialMomentum: number;
  sentimentBias: number;
  confidence: number;
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  socialVolume: number;
  socialDominance: number;
  timestamp: string;
}

export interface LunarCrushTopic {
  topic: string;
  title: string;
  galaxy_score: number;
  alt_rank: number;
  social_volume: number;
  social_dominance: number;
  market_dominance: number;
  price: number;
  percent_change_24h: number;
  market_cap: number;
  volume_24h: number;
  categories: string[];
}

export interface LunarCrushTimeSeries {
  timestamp: number;
  galaxy_score: number;
  alt_rank: number;
  social_volume: number;
  social_dominance: number;
  close: number;
  volume: number;
}

export interface SentimentOverview {
  symbol: string;
  overall: "BULLISH" | "BEARISH" | "NEUTRAL";
  score: number; // -1 to 1
  galaxyScore: number;
  altRank: number;
  socialVolume24h: number;
  socialDominance: number;
  topCreators: CreatorInfo[];
  trendingTopics: string[];
}

export interface CreatorInfo {
  name: string;
  followers: number;
  influence: number;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
}
