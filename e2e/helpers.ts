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

export const SITE_ROUTES = [
  "/", "/product/prediction", "/product/prevention", "/product/capture", "/product/marketplace",
  "/solutions/mini-refineries", "/solutions/gas-processing", "/solutions/lpg-depots", "/solutions/chemical-plants", "/solutions/boiler-houses",
  "/pricing", "/security", "/company", "/contact", "/resources", "/sign-in", "/sign-up",
];

export const ROUTES = [
  ...SITE_ROUTES, "/app/predict", "/app/capture", "/app/get-started", "/app/marketplace", "/app/marketplace/p/liquid-co2-food", "/app/marketplace/orders", "/app/marketplace/rfq", "/app/marketplace/seller",
  "/app/connect", "/app", "/app/measurements", "/app/departments", "/app/relays", "/app/alarms", "/app/audits", "/app/audit-history", "/app/support",
  "/app/fleet", "/app/devices/ESP32S3-N16R8-HARNESS-01", "/app/events", "/app/audit-log", "/app/shift", "/app/reports", "/app/admin", "/app/organisation",
];
