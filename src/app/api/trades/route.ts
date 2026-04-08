import { NextRequest, NextResponse } from "next/server";

const FT_BASE = "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FT_USER = "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "Imperial99Trade!";

let _jwt: { t: string; e: number } | null = null;
async function jwt() {
  if (_jwt && _jwt.e > Date.now()) return _jwt.t;
  const res = await fetch(`${FT_BASE}/token/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64")}` },
  });
  if (!res.ok) throw new Error(`Login: ${res.status}`);
  const d = await res.json();
  _jwt = { t: d.access_token, e: Date.now() + 840000 };
  return d.access_token;
}

export async function GET(req: NextRequest) {
  const limit = new URL(req.url).searchParams.get("limit") || "50";
  try {
    const token = await jwt();
    const res = await fetch(`${FT_BASE}/trades?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 15 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return NextResponse.json({ trades: data.trades || [], total: data.trades_count || 0 });
  } catch {
    return NextResponse.json({ trades: [], total: 0 });
  }
}
