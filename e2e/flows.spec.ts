import { test, expect } from "@playwright/test";
import { login, prefs } from "./helpers";

test("old console paths redirect permanently to /app", async ({ request }) => {
  const cases: [string, string][] = [
    ["/dashboard", "/app"],
    ["/alarms", "/app/alarms"],
    ["/onboarding", "/app/connect"],
    ["/welcome", "/app/organisation"],
    ["/marketplace", "/app/marketplace"],
    ["/marketplace/p/liquid-co2-food", "/app/marketplace/p/liquid-co2-food"],
    ["/devices/ESP32S3-N16R8-HARNESS-01", "/app/devices/ESP32S3-N16R8-HARNESS-01"],
  ];
  for (const [from, to] of cases) {
    const r = await request.get(from, { maxRedirects: 0 });
    expect(r.status(), from).toBe(308);
    expect(new URL(r.headers()["location"], "http://x").pathname, from).toBe(to);
  }
});

test("signed-in visitors see Open app on the site", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Book a demo" }).first()).toBeVisible();
  await login(page, "demo-viewer");
  await page.goto("/");
  await expect(page.getByTestId("open-app")).toBeVisible();
});

test("first-run flow: organisation, first site, connect, wait for data", async ({ page }) => {
  await prefs(page, { mode: "DEMO" });
  await login(page, "demo-buyer");
  await page.goto("/app/get-started");
  await page.getByLabel("Company name").fill("Rivers Gas Works");
  await page.getByLabel("Site location").fill("Onne, Rivers State");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByLabel("Facility name").fill("Onne LPG Depot");
  await page.getByLabel("Station ID").fill("ONNE-01");
  await page.getByLabel("Device thing name").fill(`E2E-THING-${Date.now()}`);
  await page.getByRole("button", { name: "Save site" }).click();
  await expect(page.getByRole("heading", { name: "Live connection diagnostics" })).toBeVisible();
  await page.getByRole("button", { name: /wait for data/ }).click();
  await expect(page.getByText("Listening for telemetry from AWS IoT Core")).toBeVisible();
  await expect(page.getByTestId("mode-badge")).toContainText("LIVE");
});

test("Use demo plant skips device connection and switches to DEMO", async ({ page }) => {
  await prefs(page, { mode: "LIVE" });
  await login(page, "demo-viewer");
  await page.goto("/app/get-started");
  await page.getByTestId("use-demo-plant").click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("mode-badge")).toContainText("DEMO");
  await expect(page.getByRole("heading", { name: "Plant overview" })).toBeVisible();
});

test("prediction page in DEMO runs ahead of the alarm", async ({ page }) => {
  await prefs(page, { mode: "DEMO" });
  await login(page, "demo-operator");
  await page.goto("/app/predict");
  await expect(page.getByTestId("risk-index")).toBeVisible();
  await page.getByRole("button", { name: "Simulate a leak build-up" }).click();
  await expect(page.getByText(/Predicted crossing in \d+ s: trip/)).toBeVisible({ timeout: 10_000 });
  // The forecast sees the trip while the reading is still below every threshold.
  await expect(page.getByText(/Forecast reaches the trip threshold in about \d+ s/)).toBeVisible();
  await expect(page.getByText("The reading is already above a threshold")).toHaveCount(0);
});

test("prediction page in LIVE without a model shows how to train one", async ({ page }) => {
  await prefs(page, { mode: "LIVE" });
  await login(page, "demo-operator");
  await page.goto("/app/predict");
  await expect(page.getByText("No trained model yet").first()).toBeVisible();
  await expect(page.getByText("train_models.py").first()).toBeVisible();
});

test("command palette jumps to a page and reaches SCRAM", async ({ page }) => {
  await prefs(page, { mode: "DEMO" });
  await login(page, "demo-operator");
  await page.goto("/app");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("alarms and");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/alarms$/);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("Trigger SCRAM");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Master SCRAM" })).toBeVisible();
});

test("contact form stores a demo request", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Your name").fill("Ada Obi");
  await page.getByLabel("Work email").fill("ada@example.com");
  await page.getByRole("textbox", { name: "Company" }).fill("Example Gas Ltd");
  await page.getByRole("button", { name: "Book a demo" }).last().click();
  await expect(page.getByText("Your request is in")).toBeVisible();
});
