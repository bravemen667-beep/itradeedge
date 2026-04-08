import { NextResponse } from "next/server";

const FT_BASE = "https://srv1436228.hstgr.cloud/ftapi/api/v1";
const FT_USER = "freqtrader";
const FT_PASS = process.env.FREQTRADE_API_PASS || "Imperial99Trade!";

export async function GET() {
  const encoded = Buffer.from(`${FT_USER}:${FT_PASS}`).toString("base64");
  let ftOk = false;
  let ftVersion = "";
  let ftBalance = 0;

  try {
    const [vRes, bRes] = await Promise.allSettled([
      fetch(`${FT_BASE}/version`, { headers: { Authorization: `Basic ${encoded}` } }),
      fetch(`${FT_BASE}/balance`, { headers: { Authorization: `Basic ${encoded}` } }),
    ]);
    if (vRes.status === "fulfilled" && vRes.value.ok) {
      const v = await vRes.value.json();
      ftVersion = v.version;
      ftOk = true;
    }
    if (bRes.status === "fulfilled" && bRes.value.ok) {
      const b = await bRes.value.json();
      ftBalance = b.total || 0;
    }
  } catch { /* */ }

  return NextResponse.json({
    status: ftOk ? "healthy" : "degraded",
    exchange: { connected: ftOk, balance: ftBalance },
    freqtrade: { connected: ftOk, running: ftOk, version: ftVersion },
    database: { connected: true },
    lunarcrush: { connected: !!process.env.LUNARCRUSH_API_KEY },
    telegram: { connected: !!process.env.TELEGRAM_BOT_TOKEN },
    timestamp: new Date().toISOString(),
  });
}
