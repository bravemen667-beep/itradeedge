import { NextRequest, NextResponse } from "next/server";

const FT_BASE = "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FT_USER = "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "Imperial99Trade!";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "50";

  try {
    const encoded = Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64");
    const res = await fetch(`${FT_BASE}/trades?limit=${limit}`, {
      headers: { Authorization: `Basic ${encoded}` },
      next: { revalidate: 15 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();

    return NextResponse.json({
      trades: data.trades || [],
      total: data.trades_count || 0,
      limit: parseInt(limit),
      offset: 0,
    });
  } catch (error) {
    return NextResponse.json({ trades: [], total: 0, limit: 50, offset: 0, error: String(error) });
  }
}
