import { NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

export async function GET() {
  try {
    const [version, balance] = await Promise.allSettled([
      ftProxy<{ version: string }>("/version"),
      ftProxy<{ total: number }>("/balance"),
    ]);
    const v = version.status === "fulfilled" ? version.value : null;
    const b = balance.status === "fulfilled" ? balance.value : null;
    return NextResponse.json({
      status: v ? "healthy" : "degraded",
      exchange: { connected: !!v, balance: b?.total || 0 },
      freqtrade: { connected: !!v, running: !!v, version: v?.version || "" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "degraded", timestamp: new Date().toISOString() });
  }
}
