import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { login, prefs, ROUTES } from "./helpers";

mkdirSync("docs/screenshots/after", { recursive: true });
const slug = (r: string) => (r === "/" ? "home" : r.slice(1).replace(/[/[\]]/g, "_"));

for (const route of ROUTES) {
  test(`loads ${route} in both themes and both modes, axe clean, screenshots`, async ({ page }) => {
    await login(page, "demo-admin");
    for (const theme of ["night", "day"] as const) {
      for (const mode of ["DEMO", "LIVE"] as const) {
        await prefs(page, { theme, mode });
        await page.setViewportSize({ width: 1440, height: 900 });
        const res = await page.goto(route);
        expect(res?.status(), `${route} ${theme} ${mode}`).toBeLessThan(400);
        // goto follows redirects; a page reachable only through a stale redirect must fail here.
        expect(new URL(page.url()).pathname, `${route} redirected away`).toBe(route);
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.getByText("This page hit an error")).toHaveCount(0);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        if (mode === "DEMO") {
          await page.waitForTimeout(1200);
          await page.screenshot({ path: `docs/screenshots/after/${slug(route)}-${theme}-1440.png`, fullPage: true });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.waitForTimeout(400);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${route} horizontal scroll at 390 px`).toBeLessThanOrEqual(1);
          await page.screenshot({ path: `docs/screenshots/after/${slug(route)}-${theme}-390.png`, fullPage: true });
        }
        if (theme === "night" && mode === "DEMO") {
          await page.setViewportSize({ width: 1440, height: 900 });
          const axe = await new AxeBuilder({ page }).analyze();
          const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `axe ${route}`).toEqual([]);
        }
      }
    }
  });
}
