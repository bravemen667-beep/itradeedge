import { NextRequest, NextResponse } from "next/server";
import { dataPipeline } from "@/lib/data/massive-data-pipeline";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  try {
    if (symbol) {
      // Wrap the single-symbol response in an envelope so callers always
      // destructure a known shape (`{ signal }` here vs `{ signals }` for
      // the multi case) instead of branching on the top-level type.
      const signal = await dataPipeline.getAggregatedSignal(symbol);
      return NextResponse.json({ signal, timestamp: new Date().toISOString() });
    }

    const signals = await dataPipeline.getAllSignals();
    return NextResponse.json({ signals, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch intelligence signals", details: String(error) },
      { status: 502 }
    );
  }
}
