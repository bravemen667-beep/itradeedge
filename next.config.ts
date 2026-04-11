import type { NextConfig } from "next";

// Baseline security headers applied to every response. Set here (rather than
// in middleware.ts) so the framework injects them once at config time and
// every route — pages, API, static — gets them without per-request CPU.
//
// Notable omissions and reasoning:
//  - Content-Security-Policy: requires careful per-app tuning to avoid
//    breaking inline script/style/eval. Left for the operator to configure
//    after testing in staging. Documented in FINAL_REPORT_PASS2.md.
//  - Strict-Transport-Security: Vercel sets this automatically on the
//    *.vercel.app domain. Add explicitly here only if hosting elsewhere.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
