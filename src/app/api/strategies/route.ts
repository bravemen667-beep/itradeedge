import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const strategies = await prisma.strategy.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { trades: true } } },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, type, parameters, description, enabled } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: { name, type, parameters: parameters || {}, description, enabled: enabled ?? false },
  });
  return NextResponse.json(strategy, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const strategy = await prisma.strategy.update({
    where: { id },
    data: updates,
  });
  return NextResponse.json(strategy);
}
