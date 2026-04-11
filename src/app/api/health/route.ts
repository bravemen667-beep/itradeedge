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
    // Type-guard b?.total — the upstream Freqtrade API contract isn't enforced
    // at runtime, so a non-numeric value would otherwise propagate into the UI.
    const totalBalance = typeof b?.total === "number" ? b.total : 0;
    return NextResponse.json({
      status: v ? "healthy" : "degraded",
      exchange: { connected: !!v, balance: totalBalance },
      freqtrade: { connected: !!v, running: !!v, version: v?.version || "" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "degraded", timestamp: new Date().toISOString() });
  }
}
