import type { Page } from "@playwright/test";

export async function login(page: Page, userId: string) {
  const r = await page.request.post("/api/demo-login", { data: { userId } });
  if (!r.ok()) throw new Error(`login ${userId}: ${r.status()}`);
}

export async function prefs(page: Page, p: { theme?: "night" | "day"; mode?: "DEMO" | "LIVE" }) {
  await page.addInitScript((v) => {
    localStorage.setItem("clathra-prefs", JSON.stringify({ state: { unit: "PCT", currency: "NGN", theme: v.theme ?? "night", mode: v.mode ?? "DEMO" }, version: 0 }));
  }, p);
}

export const SITE_ROUTES = ["/", "/pricing", "/contact", "/sign-in", "/sign-up"];

export const ROUTES = [
  ...SITE_ROUTES,
  "/app", "/app/fleet", "/app/monitoring", "/app/monitoring/trends", "/app/plant", "/app/plant/3d",
  "/app/history", "/app/history/gas", "/app/history/alarms", "/app/history/export", "/app/capture", "/app/departments",
  "/app/alarms", "/app/alarms/tiers", "/app/alarms/events", "/app/alarms/audit", "/app/alarms/shift",
  "/app/ai", "/app/ai/predictions", "/app/ai/sensor-health", "/app/ai/solvent", "/app/ai/training",
  "/app/marketplace", "/app/marketplace/p/liquid-co2-food", "/app/marketplace/orders", "/app/marketplace/seller",
  "/app/settings/connect", "/app/settings/site", "/app/settings/sensors", "/app/settings/users", "/app/settings/alarm-limits",
  "/app/maintenance", "/app/audits", "/app/support", "/app/audit-history", "/app/get-started", "/app/organisation", "/app/devices/ESP32S3-N16R8-HARNESS-01",
];
