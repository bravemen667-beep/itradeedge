import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const pair = searchParams.get("pair");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (pair) where.pair = pair;

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { entryTime: "desc" },
      take: limit,
      skip: offset,
      include: { strategy: { select: { name: true, type: true } } },
    }),
    prisma.trade.count({ where }),
  ]);

  return NextResponse.json({ trades, total, limit, offset });
}
