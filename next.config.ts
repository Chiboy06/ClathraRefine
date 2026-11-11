import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Clerk loads its UI from its own frontend API host; Paystack is a full-page redirect so needs no CSP entry.
// Convex needs https + wss on *.convex.cloud (WebSocket reactive queries) and https on *.convex.site (HTTP actions).
// Clerk bot-protection probes go to *.client.protect.clerk.com on non-standard ports.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://*.client.protect.clerk.com",
    "https://*.amazonaws.com",
    "https://*.convex.cloud",
    "wss://*.convex.cloud",
    "https://*.convex.site",
  ].join(" "),
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
  // Old paths moved twice: under /app (modification brief) and into the top tabs (remodification brief).
  async redirects() {
    // Final home of every moved page, so no redirect chains.
    const app: Record<string, string> = {
      events: "/app/alarms/events",
      "audit-log": "/app/alarms/audit",
      shift: "/app/alarms/shift",
      predict: "/app/ai/predictions",
      connect: "/app/settings/connect",
      "settings/users": "/app/admin",
      reports: "/app/history/export",
      relays: "/app/plant",
      measurements: "/app/history",
      "marketplace/rfq": "/app/marketplace/orders",
      "devices/:p*": "/app/maintenance",
    };
    const top: Record<string, string> = {
      dashboard: "/app",
      onboarding: "/app/settings/connect",
      welcome: "/app/organisation",
      admin: "/app/admin",
      ...app,
    };
    const sameUnderApp = ["fleet", "departments", "alarms", "marketplace/:p*", "marketplace", "audits", "audit-history", "support"];
    const removed = ["product/:p*", "solutions/:p*", "company", "resources", "security"];
    return [
      ...Object.entries(app).map(([k, v]) => ({ source: `/app/${k}`, destination: v, permanent: true })),
      ...Object.entries(top).map(([k, v]) => ({ source: `/${k}`, destination: v, permanent: true })),
      ...sameUnderApp.map((m) => ({ source: `/${m}`, destination: `/app/${m}`, permanent: true })),
      ...removed.map((m) => ({ source: `/${m}`, destination: "/", permanent: true })),
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
