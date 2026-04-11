import { NextRequest, NextResponse } from "next/server";
import { lunarcrush } from "@/lib/api/lunarcrush-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") || "BTC,ETH,SOL,BNB").split(",");

  try {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const topic = await lunarcrush.getTopic(symbol.trim());
        return {
          symbol: symbol.trim().toUpperCase(),
          galaxyScore: topic.galaxy_score,
          altRank: topic.alt_rank,
          socialDominance: topic.social_dominance,
          price: topic.price,
          priceChange24h: topic.percent_change_24h,
        };
      })
    );

    const data = results
      .filter((r): r is PromiseFulfilledResult<{ symbol: string; galaxyScore: number; altRank: number; socialDominance: number; price: number; priceChange24h: number }> => r.status === "fulfilled")
      .map((r) => r.value);

    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch galaxy scores", details: String(error) },
      { status: 502 }
    );
  }
}
