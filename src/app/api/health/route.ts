import { NextResponse } from "next/server";
import { freqtradeClient } from "@/lib/api/freqtrade-client";
import type { HealthStatus } from "@/types/trading";

export async function GET() {
  const health: HealthStatus = {
    status: "healthy",
    exchange: { connected: false, balance: 0 },
    freqtrade: { connected: false, running: false },
    database: { connected: false },
    lunarcrush: { connected: false },
    telegram: { connected: false },
    timestamp: new Date().toISOString(),
  };

  // Check Freqtrade
  try {
    const version = await freqtradeClient.version();
    const balance = await freqtradeClient.getBalance();
    health.freqtrade = { connected: true, running: true, version: version.version };
    health.exchange = { connected: true, balance: balance.total || 0 };
  } catch {
    health.status = "degraded";
  }

  // Check database
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    health.database = { connected: true };
  } catch {
    health.status = "degraded";
  }

  // Check LunarCrush
  try {
    if (process.env.LUNARCRUSH_API_KEY) {
      const res = await fetch("https://lunarcrush.com/api4/public/coins/list", {
        headers: { Authorization: `Bearer ${process.env.LUNARCRUSH_API_KEY}` },
      });
      health.lunarcrush = { connected: res.ok };
    }
  } catch {
    // Non-critical
  }

  // Check Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`
      );
      health.telegram = { connected: res.ok };
    } catch {
      // Non-critical
    }
  }

  const degradedCount = [
    health.exchange.connected,
    health.freqtrade.connected,
    health.database.connected,
  ].filter((v) => !v).length;

  if (degradedCount >= 2) health.status = "unhealthy";

  return NextResponse.json(health);
}
