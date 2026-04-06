import { NextRequest, NextResponse } from "next/server";
import { freqtradeClient } from "@/lib/api/freqtrade-client";

/**
 * Proxy all requests to Freqtrade REST API
 * e.g., /api/freqtrade/status → Freqtrade /api/v1/status
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const ftPath = `/${path.join("/")}`;

  try {
    const data = await freqtradeClient.proxy(ftPath, "GET");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Freqtrade proxy error: ${ftPath}`, details: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const ftPath = `/${path.join("/")}`;

  try {
    const body = await req.json().catch(() => undefined);
    const data = await freqtradeClient.proxy(ftPath, "POST", body);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Freqtrade proxy error: ${ftPath}`, details: String(error) },
      { status: 502 }
    );
  }
}
