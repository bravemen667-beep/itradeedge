import { NextRequest, NextResponse } from "next/server";
import { ftProxy } from "@/lib/api/ft-proxy";

// Allowlisted Freqtrade API paths to prevent SSRF
const ALLOWED_PATHS = new Set([
  "/ping", "/version", "/health",
  "/balance", "/status", "/profit", "/performance",
  "/show_config", "/strategies", "/trades",
  "/daily", "/stats", "/locks", "/logs",
  "/backtest", "/start", "/stop",
  "/forceenter", "/forceexit", "/forcesell",
]);

function isAllowedPath(ftPath: string): boolean {
  // Strip query string for matching, match the base path
  const basePath = ftPath.split("?")[0];
  if (ALLOWED_PATHS.has(basePath)) return true;
  // Allow /strategy/{name} pattern
  if (/^\/strategy\/[\w-]+$/.test(basePath)) return true;
  // Allow /trades with query params
  if (basePath === "/trades") return true;
  // Per-bot fan-out: /bot/<name>/<allowed-suffix> routes to that specific
  // freqtrade container via the proxy. The suffix is itself checked against
  // the allowlist so this can't be used to reach arbitrary endpoints.
  const botMatch = basePath.match(/^\/bot\/[a-z]+(\/.+)?$/);
  if (botMatch) {
    const suffix = botMatch[1] || "/";
    if (ALLOWED_PATHS.has(suffix)) return true;
    if (/^\/strategy\/[\w-]+$/.test(suffix)) return true;
  }
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const ftPath = `/${path.join("/")}`;
  if (!isAllowedPath(ftPath)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }
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
  if (!isAllowedPath(ftPath)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => undefined);
    const data = await ftProxy(ftPath, "POST", body);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: `Freqtrade proxy error: ${ftPath}`, details: String(error) }, { status: 502 });
  }
}
