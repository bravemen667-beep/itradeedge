import { NextRequest, NextResponse } from "next/server";
import { lunarcrush } from "@/lib/api/lunarcrush-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "BTC";

  try {
    const topic = await lunarcrush.getTopic(symbol);
    const timeSeries = await lunarcrush.getTimeSeries(symbol, "1w");

    return NextResponse.json({
      symbol,
      galaxyScore: topic.galaxy_score,
      altRank: topic.alt_rank,
      socialVolume: topic.social_volume,
      socialDominance: topic.social_dominance,
      price: topic.price,
      priceChange24h: topic.percent_change_24h,
      timeSeries: timeSeries.slice(-7),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sentiment", details: String(error) },
      { status: 502 }
    );
  }
}
