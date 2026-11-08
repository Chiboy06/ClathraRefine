import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Clerk loads its UI from its own frontend API host; Paystack is a full-page redirect so needs no CSP entry.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.amazonaws.com",
  "frame-src https://challenges.cloudflare.com https://*.clerk.accounts.dev",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // Old console paths moved under /app (docs/MODIFICATION_MAP.md).
  async redirects() {
    const moved = ["fleet", "devices/:p*", "events", "shift", "measurements", "departments", "reports", "relays", "alarms", "marketplace/:p*", "marketplace", "audits", "audit-history", "audit-log", "support", "admin"];
    return [
      { source: "/dashboard", destination: "/app", permanent: true },
      { source: "/onboarding", destination: "/app/connect", permanent: true },
      { source: "/welcome", destination: "/app/organisation", permanent: true },
      ...moved.map((m) => ({ source: `/${m}`, destination: `/app/${m}`, permanent: true })),
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
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
