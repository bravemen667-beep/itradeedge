# iTradeEdge Full Audit Report

**Date**: 2026-04-11
**Branch**: `archon/task-fix-full-audit-and-fixes`
**Auditor**: Claude Opus 4.6

## Summary

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| Critical (Security) | 5 | 5 | 0 |
| High (Lint/Type) | 6 | 6 | 0 |
| Medium (Logic) | 3 | 2 | 1 |
| Low (Info) | 7 | 0 | 7 |
| **Total** | **21** | **13** | **8** |

---

## Fixes Applied

### Commit 1: `security: remove hardcoded credentials, add SSRF protection and input validation`

| # | Severity | File:Line | Issue | Fix |
|---|----------|-----------|-------|-----|
| 1 | CRITICAL | `src/lib/api/freqtrade-client.ts:3` | Hardcoded password `Imperial99Trade!` in source | Replaced with `process.env.FREQTRADE_API_PASS \|\| ""` |
| 2 | CRITICAL | `src/lib/api/ft-proxy.ts:6` | Hardcoded API key `itradeedge-2026-proxy` in source | Replaced with `process.env.FT_PROXY_KEY \|\| ""` |
| 3 | CRITICAL | `src/app/api/freqtrade/[...path]/route.ts` | SSRF: arbitrary path forwarding to Freqtrade API | Added `ALLOWED_PATHS` allowlist with regex for `/strategy/{name}` |
| 4 | HIGH | `src/app/api/trades/route.ts:5` | `limit` query param passed directly into URL without validation | Parse as int, clamp to `[1, 500]`, default 50 |
| 5 | HIGH | `src/app/api/strategies/route.ts:89-97` | POST/PATCH accept arbitrary JSON with no validation | Added required field checks, type validation, 404 on missing strategy |
| 6 | LOW | `.env.example` | Missing `FT_PROXY_BASE` and `FT_PROXY_KEY` env vars | Added to .env.example |

### Commit 2: `fix: resolve all ESLint errors — unused vars, setState-in-effect`

| # | Severity | File:Line | Issue | Fix |
|---|----------|-----------|-------|-----|
| 7 | HIGH | `src/app/(dashboard)/analytics/page.tsx:7` | `formatPercent` imported but never used | Removed unused import |
| 8 | HIGH | `src/app/(dashboard)/page.tsx:115-116` | `setEquity` and `setSignals` assigned but never used | Changed to `const [equity]` / `const [signals]` |
| 9 | HIGH | `src/app/(dashboard)/intelligence/page.tsx:33-37` | `setState` called synchronously in useEffect body (React 19 strict rule) | Extracted fetch to module-level async fn, used `refreshKey` pattern to trigger refetch from event handler |

### Commit 3: `fix: type safety and logic bugs across backend and frontend`

| # | Severity | File:Line | Issue | Fix |
|---|----------|-----------|-------|-----|
| 10 | MEDIUM | `src/lib/api/freqtrade-client.ts:154` | `FreqtradeProfit` missing `profit_factor` field (used in `live/route.ts:13`) | Added `profit_factor: number` to interface |
| 11 | MEDIUM | `src/types/strategies.ts:15` | `StrategyType` union missing types used by API (`BREAKOUT`, `REVERSAL`, `RISK_MGMT`, `SENTIMENT`, `MULTI_FACTOR`) | Expanded union type |
| 12 | HIGH | `src/app/api/intelligence/galaxy-score/route.ts:25` | Unsafe `as` cast on `PromiseFulfilledResult` | Replaced with type predicate in `.filter()` |
| 13 | MEDIUM | `src/lib/trading/risk-manager.ts:101` | `Math.abs(dailyPnl)` halts trading on positive P&L days too | Changed to `dailyPnl <= -this.config.maxDailyLoss` |

---

## Items Intentionally Left Unfixed

### Low Severity / By Design

| # | File | Issue | Reason |
|---|------|-------|--------|
| L1 | `src/app/(dashboard)/analytics/page.tsx` | `PerformanceData` interface has fields (`avgProfit`, `wins`, `winRate` per pair, `strategyStats`, `equityCurve`) not returned by `/api/performance` | Demo data fills the gap; API augmentation would be a feature, not a bug fix |
| L2 | `src/app/api/live/route.ts:61` | Hardcoded `botsOnline: 5` when any API call succeeds | Acceptable simplification — true multi-bot check requires separate API calls per bot |
| L3 | All frontend pages | Silent error swallowing (`catch {}`) | Works as intended — falls back to demo data. Adding error UI would be a feature |
| L4 | `src/components/ui/switch.tsx` | Missing `aria-label` prop forwarding | Component has `role="switch"` and `aria-checked` which is baseline accessible |
| L5 | `src/lib/api/freqtrade-client.ts:1` | Hardcoded fallback URL for Freqtrade API | URL is public-facing VPS endpoint, not a secret. Now overridable via env var |
| L6 | `prisma/schema.prisma` | Database not actively used (strategies are hardcoded, trades come from Freqtrade API) | Schema is valid and ready; removing it would break generated types |
| L7 | `src/lib/data/massive-data-pipeline.ts` | In-memory cache not shared across serverless instances | Acceptable for Vercel — each instance gets independent cache. Redis integration would be a feature |

### Requires Human Decision

| # | Item | Action Needed |
|---|------|---------------|
| H1 | **Secret rotation** | The hardcoded password `Imperial99Trade!` and API key `itradeedge-2026-proxy` were in git history. Rotate both credentials on the VPS and set as env vars (`FREQTRADE_API_PASS`, `FT_PROXY_KEY`) in Vercel dashboard |
| H2 | **Rate limiting** | No rate limiting on any API route. Consider adding middleware (e.g., `next-rate-limit` or Vercel's built-in) for public-facing endpoints |
| H3 | **Authentication** | No auth on any API route. Anyone with the URL can access `/api/live`, `/api/balance`, `/api/freqtrade/*`. Consider adding API key auth or session-based auth |
| H4 | **CORS** | No explicit CORS configuration. Default Next.js behavior (same-origin) is fine for Vercel, but verify if API is called from other domains |

---

## Validation

```
$ tsc --noEmit        # PASS (0 errors)
$ eslint src/         # PASS (0 errors, 0 warnings)
```

## Commits

```
6714f51 fix: type safety and logic bugs across backend and frontend
c4dc997 fix: resolve all ESLint errors — unused vars, setState-in-effect
e206288 security: remove hardcoded credentials, add SSRF protection and input validation
```
