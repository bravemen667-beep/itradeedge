import { NextRequest, NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

export async function GET(req: NextRequest) {
  const limit = new URL(req.url).searchParams.get("limit") || "50";
  try {
    const data = await ftProxy<{ trades: unknown[]; trades_count: number }>(`/trades?limit=${limit}`);
    return NextResponse.json({ trades: data.trades, total: data.trades_count });
  } catch {
    return NextResponse.json({ trades: [], total: 0 });
  }
}
