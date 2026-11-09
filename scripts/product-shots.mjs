// Renders real app pages at 2x for the marketing site: node scripts/product-shots.mjs [baseUrl]
// Needs a running server with DEMO_AUTH=true (for example: npx next start -p 3100).
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const SHOTS = [
  // Still of the 3D view for the overview plant card.
  { file: "plant-3d", path: "/app/plant/3d", theme: "day", out: "public/images/plant-3d.png", selector: "canvas" },
  { file: "predict", path: "/app/ai/predictions", theme: "day", leakWaitMs: 12_000 },
  { file: "alarms", path: "/app/alarms", theme: "night", leakWaitMs: 28_000 },
  { file: "plant", path: "/app/plant", theme: "day" },
  { file: "marketplace", path: "/app/marketplace", theme: "day" },
];

const browser = await chromium.launch();
for (const s of SHOTS) {
  const ctx = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await ctx.addInitScript((theme) => localStorage.setItem("clathra-prefs", JSON.stringify({ state: { unit: "PCT", currency: "NGN", theme, mode: "DEMO" }, version: 0 })), s.theme);
  const page = await ctx.newPage();
  await page.request.post("/api/demo-login", { data: { userId: "demo-operator" } });
  await page.goto(s.path);
  await page.waitForTimeout(2500);
  if (s.leakWaitMs) {
    await page.getByRole("button", { name: /Simulate a leak build-up|Trigger leak/ }).first().click();
    await page.waitForTimeout(s.leakWaitMs);
  }
  const out = s.out ?? `public/images/product/${s.file}.png`;
  if (s.selector) await page.locator(s.selector).first().screenshot({ path: out });
  else await page.screenshot({ path: out });
  console.log("saved", s.file);
  await ctx.close();
}
await browser.close();
