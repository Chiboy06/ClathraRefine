import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Open Graph card in the hero's style: the headline over the forecast-ahead-of-reading motif. */
export function ogImage(title: string, label = "ClathraRefine") {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F8FAFC", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700, color: "#0F172A" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#0B1222", display: "flex" }} />
          {label}
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, color: "#0F172A", lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{title}</div>
        <svg width="1056" height="120" viewBox="0 0 1056 120">
          <line x1="0" y1="24" x2="1056" y2="24" stroke="#DC2626" strokeWidth="3" strokeDasharray="10 10" />
          <path d="M0 108 C 200 108, 360 104, 520 80" stroke="#0F172A" strokeWidth="7" fill="none" />
          <path d="M520 80 C 640 60, 760 30, 900 14" stroke="#2563EB" strokeWidth="7" fill="none" strokeDasharray="16 12" />
          <circle cx="520" cy="80" r="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="6" />
        </svg>
      </div>
    ),
    OG_SIZE,
  );
}
