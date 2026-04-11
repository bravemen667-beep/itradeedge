import { NextRequest, NextResponse } from "next/server";

// Edge middleware that protects /api/* routes with:
//  1. Same-origin gating via the Sec-Fetch-Site header (set by all modern
//     browsers and impossible to forge from page JS) so the dashboard SPA
//     keeps working without ever embedding a key in client code.
//  2. Optional X-API-Key check against process.env.API_KEY for server-side
//     callers / cron jobs / external monitoring.
//  3. Per-IP sliding-window rate limit (default: 60 req/min).
//
// /api/health is always public so uptime monitors don't need credentials.
//
// Limitations:
//  - The rate-limit map is in-memory. On Vercel each serverless instance has
//    its own bucket, so the effective limit per IP can exceed `RATE_LIMIT`
//    when traffic is spread across instances. For strict global limits use
//    Vercel KV / Upstash Redis. Documented in FINAL_REPORT_PASS2.md.
//  - In development (NODE_ENV !== 'production') the auth check is bypassed so
//    `next dev` works without setup.

const RATE_LIMIT = 60;            // requests
const RATE_WINDOW_MS = 60_000;    // per minute

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function checkRate(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + RATE_WINDOW_MS };
    buckets.set(ip, fresh);
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: fresh.resetAt };
  }
  if (existing.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count++;
  return { allowed: true, remaining: RATE_LIMIT - existing.count, resetAt: existing.resetAt };
}

function isAuthorized(req: NextRequest): boolean {
  // Dev mode: trust localhost / next dev. Production-only enforcement keeps
  // the dashboard usable for `npm run dev` without env setup.
  if (process.env.NODE_ENV !== "production") return true;

  // Same-origin from a browser → allow. Sec-Fetch-Site is set by every modern
  // browser and cannot be forged from page JS.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;

  // Server-side caller with the configured key → allow.
  const expected = process.env.API_KEY;
  if (expected) {
    const provided = req.headers.get("x-api-key");
    if (provided && provided === expected) return true;
  }

  return false;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // /api/health is always public — no auth, no rate limit.
  if (path === "/api/health" || path.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  // Rate limit before auth so abusive callers can't burn auth-check CPU.
  const ip = clientIp(req);
  const rate = checkRate(ip);
  if (!rate.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfterMs: rate.resetAt - Date.now() }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(rate.resetAt / 1000)),
        },
      }
    );
  }

  if (!isAuthorized(req)) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'ApiKey realm="itradeedge"',
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(RATE_LIMIT));
  res.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.floor(rate.resetAt / 1000)));
  return res;
}

export const config = {
  // Run on every /api route. Static assets and pages are unaffected.
  matcher: ["/api/:path*"],
};
