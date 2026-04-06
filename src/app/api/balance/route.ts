import { NextResponse } from "next/server";
import { freqtradeClient } from "@/lib/api/freqtrade-client";

export async function GET() {
  try {
    const balance = await freqtradeClient.getBalance();

    return NextResponse.json({
      total: balance.total,
      currencies: balance.currencies.map((c) => ({
        currency: c.currency,
        total: c.balance,
        free: c.free,
        used: c.used,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch balance", details: String(error) },
      { status: 502 }
    );
  }
}
