import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Security review (Module 8): defense-in-depth Content Security Policy.
// React already renders catalog text inertly; CSP limits damage if that ever regresses.
// 'unsafe-inline' scripts are required by Next.js without nonces; 'unsafe-eval' is dev-only (React debugging).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // globals.css imports Google Fonts; allow exactly those two hosts and nothing else.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' blob: data:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const config: NextConfig = {
  poweredByHeader: false,
  // Dev server only: let other devices open the site by any IPv4 address (http://a.b.c.d:3000) and load dev assets/HMR.
  // Each "*" matches one label, so this covers every IPv4 address. Has no effect on `next build` / `next start`.
  allowedDevOrigins: ["*.*.*.*"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // Browsers ignore HSTS over plain HTTP, so local development is unaffected (NFR-02).
      ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
    ] }];
  },
};
export default config;
