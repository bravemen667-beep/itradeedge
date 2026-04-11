import { NextRequest, NextResponse } from "next/server";

// Stub settings endpoint. The Settings page used to fake-save by flashing a
// "Saved!" label without ever calling an API. We don't yet have a settings
// table in Prisma and the production runtime config is sourced from env vars
// on Vercel/VPS, so this endpoint deliberately does NOT persist anything —
// it validates the body and returns a clear { persisted: false } result so
// the UI can be honest about what happened.
//
// When a real settings store is introduced, swap the validate-and-return
// here for a real Prisma upsert and flip persisted: true.

interface SettingsBody {
  paperTrading: boolean;
  notifications: boolean;
  sentimentFilter: boolean;
  risk: {
    maxDrawdown: number;
    maxPositionSize: number;
    maxOpenTrades: number;
    riskPerTrade: number;
    maxDailyLoss: number;
    trailingStop: number;
  };
}

function validate(body: unknown): { ok: true; value: SettingsBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "body must be an object" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.paperTrading !== "boolean") return { ok: false, error: "paperTrading must be boolean" };
  if (typeof b.notifications !== "boolean") return { ok: false, error: "notifications must be boolean" };
  if (typeof b.sentimentFilter !== "boolean") return { ok: false, error: "sentimentFilter must be boolean" };
  if (typeof b.risk !== "object" || b.risk === null) return { ok: false, error: "risk must be an object" };
  const r = b.risk as Record<string, unknown>;
  const numFields = ["maxDrawdown", "maxPositionSize", "maxOpenTrades", "riskPerTrade", "maxDailyLoss", "trailingStop"] as const;
  for (const f of numFields) {
    if (typeof r[f] !== "number" || !Number.isFinite(r[f] as number)) {
      return { ok: false, error: `risk.${f} must be a finite number` };
    }
  }
  return { ok: true, value: b as unknown as SettingsBody };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    persisted: false,
    message:
      "Settings validated but not persisted. Configure runtime values via env vars on Vercel/VPS — see .env.example.",
  });
}

export async function GET() {
  // Echo back the defaults — the real values live in env vars and are read
  // by the libs that need them (risk-manager, telegram, lunarcrush, etc.).
  return NextResponse.json({
    paperTrading: true,
    notifications: true,
    sentimentFilter: true,
    risk: {
      maxDrawdown: 15,
      maxPositionSize: 10,
      maxOpenTrades: 3,
      riskPerTrade: 2,
      maxDailyLoss: 5,
      trailingStop: 2.5,
    },
    persisted: false,
    note: "Defaults only — runtime config is env-managed.",
  });
}
