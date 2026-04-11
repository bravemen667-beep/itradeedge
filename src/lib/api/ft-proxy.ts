/**
 * Freqtrade API client via auth proxy on VPS
 * Proxy handles JWT auth internally — just needs API key
 */
const PROXY_BASE = process.env.FT_PROXY_BASE || "https://srv1436228.hstgr.cloud/ftproxy/proxy";
const PROXY_KEY = process.env.FT_PROXY_KEY || "";

export async function ftProxy<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${PROXY_BASE}${path}`, {
    method,
    headers: {
      "x-api-key": PROXY_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 15 },
  });
  if (!res.ok) throw new Error(`FT Proxy ${res.status}: ${path}`);
  return res.json();
}
