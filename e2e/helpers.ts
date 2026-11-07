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

export const ROUTES = [
  "/", "/sign-in", "/sign-up", "/pricing", "/marketplace", "/marketplace/p/liquid-co2-food", "/marketplace/orders", "/marketplace/rfq", "/marketplace/seller",
  "/onboarding", "/dashboard", "/measurements", "/departments", "/relays", "/alarms", "/audits", "/audit-history", "/support",
  "/fleet", "/devices/ESP32S3-N16R8-HARNESS-01", "/events", "/audit-log", "/shift", "/reports", "/admin", "/welcome",
];
