import type { NextConfig } from "next";
import path from "node:path";

const supabaseHost = "ljbfotxokutparojwyqq.supabase.co";

const dev = process.env.NODE_ENV === "development";

// 'unsafe-inline' scripts: Next's inline bootstrap needs it unless nonces are implemented. React's dev build
// also needs eval, and upgrade-insecure-requests breaks http://localhost subresources in Safari.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  // Audit, Builder, Advisor and sign-in are shelved in app/_shelved while the site is Claude-first.
  async redirects() {
    return [
      { source: "/audit", destination: "/requirements", permanent: false },
      { source: "/builder", destination: "/schedule", permanent: false },
      { source: "/advisor", destination: "/", permanent: false },
      { source: "/login", destination: "/schedule", permanent: false },
      { source: "/favicon.ico", destination: "/icon.svg", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
