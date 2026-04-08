import { NextResponse } from "next/server";

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

export async function GET() {
  let ftOk = false, ftVersion = "", ftBalance = 0;
  try {
    const token = await jwt();
    const h = { Authorization: `Bearer ${token}` };
    const [vRes, bRes] = await Promise.allSettled([
      fetch(`${FT_BASE}/version`, { headers: h }),
      fetch(`${FT_BASE}/balance`, { headers: h }),
    ]);
    if (vRes.status === "fulfilled" && vRes.value.ok) {
      ftVersion = (await vRes.value.json()).version;
      ftOk = true;
    }
    if (bRes.status === "fulfilled" && bRes.value.ok) {
      ftBalance = (await bRes.value.json()).total || 0;
    }
  } catch { /* */ }

  return NextResponse.json({
    status: ftOk ? "healthy" : "degraded",
    exchange: { connected: ftOk, balance: ftBalance },
    freqtrade: { connected: ftOk, running: ftOk, version: ftVersion },
    timestamp: new Date().toISOString(),
  });
}
