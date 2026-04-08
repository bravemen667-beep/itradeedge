import { NextRequest, NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const ftPath = `/${path.join("/")}`;
  try {
    const data = await ftProxy(ftPath);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: `Freqtrade proxy error: ${ftPath}`, details: String(error) }, { status: 502 });
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
    const data = await ftProxy(ftPath, "POST", body);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: `Freqtrade proxy error: ${ftPath}`, details: String(error) }, { status: 502 });
  }
}
