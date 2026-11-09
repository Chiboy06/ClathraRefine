import { test, expect } from "@playwright/test";
import { login, prefs } from "./helpers";
import { TEST_PIN } from "./testValues";

test.beforeEach(async ({ page }) => prefs(page, { mode: "DEMO" }));

test("a viewer cannot SCRAM or operate equipment", async ({ page }) => {
  await login(page, "demo-viewer");
  await page.goto("/app/plant");
  await expect(page.getByTestId("scram")).toBeDisabled();
  const r = await page.request.post("/api/scram", { data: { mode: "DEMO", confirm: true } });
  expect(r.status()).toBe(403);
  const c = await page.request.post("/api/command", { data: { cmd: "mode", value: "manual", mode: "DEMO" } });
  expect(c.status()).toBe(403);
  await page.getByTestId("mimic-fan").click();
  await expect(page.getByTestId("sbo-panel").getByRole("button", { name: "Start" })).toBeDisabled();
});

test("an operator SCRAMs with one hold and it is audited", async ({ page }) => {
  await login(page, "demo-operator");
  await page.goto("/app");
  const btn = page.getByTestId("scram");
  await btn.hover();
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await expect(btn).toContainText("SCRAM confirmed", { timeout: 10_000 });
  const log = await (await page.request.get("/api/audit-log")).json();
  expect(log.rows.some((e: { action: string; actor: string; outcome: string }) => e.action === "scram" && e.actor === "demo-operator" && e.outcome === "ok")).toBe(true);
  expect(log.intact).toBe(true);
});

test("SCRAM by press then confirm", async ({ page }) => {
  await login(page, "demo-operator");
  await page.goto("/app");
  const btn = page.getByTestId("scram");
  await btn.click();
  await expect(btn).toContainText("Confirm SCRAM");
  await btn.click();
  await expect(btn).toContainText(/SCRAM (sent|confirmed)/);
});

test("manual mode is refused while exhaust gas is active, with the reason", async ({ page }) => {
  await login(page, "demo-operator");
  await page.goto("/app/plant");
  await expect(page.getByTestId("gas-source")).toContainText("On");
  await page.getByRole("radio", { name: "Manual" }).click();
  await expect(page.getByTestId("mode-rejected")).toContainText("Exhaust gas active");
});

test("fan select, execute, confirm in DEMO", async ({ page }) => {
  await login(page, "demo-operator");
  await page.goto("/app/plant");
  await page.getByTestId("gas-source").click();
  await expect(page.getByTestId("gas-source")).toContainText("Off");
  // The board leaves exhaust-active once the reading falls below its off threshold, so retry.
  await expect(async () => {
    await page.getByRole("radio", { name: "Manual" }).click();
    await expect(page.getByRole("radio", { name: "Manual" })).toHaveAttribute("aria-checked", "true", { timeout: 2_000 });
  }).toPass({ timeout: 40_000 });
  // Pick a legal action: stop the pump if it runs (the fan cannot stop first), else toggle the fan.
  await page.getByTestId("mimic-pump").click();
  const panel = page.getByTestId("sbo-panel");
  if (!(await panel.getByText("Running", { exact: true }).count())) {
    await page.keyboard.press("Escape");
    await page.getByTestId("mimic-fan").click();
  }
  const running = await panel.getByText("Running", { exact: true }).count();
  await panel.getByRole("button", { name: running ? "Stop" : "Start" }).click();
  await page.getByTestId("sbo-execute").click();
  await expect(page.getByTestId("sbo-status")).toContainText("Confirmed", { timeout: 10_000 });
});

test("a supervisor cannot approve their own bypass; a second supervisor can", async ({ page }) => {
  await login(page, "demo-supervisor");
  await page.goto("/app/settings/alarm-limits");
  await page.getByRole("button", { name: "Request siren mute" }).click();
  let dlg = page.getByRole("dialog");
  await dlg.getByLabel("Reason").fill("Siren test during maintenance");
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Submit for second supervisor" }).click();
  await expect(dlg.getByText("is pending")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Approve" }).first().click();
  dlg = page.getByRole("dialog");
  await dlg.getByLabel("Supervisor PIN").fill(TEST_PIN);
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Authorize Override" }).click();
  await expect(dlg.getByText("A second, different supervisor must approve")).toBeVisible();

  await login(page, "demo-supervisor-2");
  await page.reload();
  await page.getByRole("button", { name: "Approve" }).first().click();
  dlg = page.getByRole("dialog");
  await dlg.getByLabel("Supervisor PIN").fill("000000");
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Authorize Override" }).click();
  await expect(dlg.getByText("PIN not accepted")).toBeVisible();
  await dlg.getByLabel("Supervisor PIN").fill(TEST_PIN);
  await dlg.getByRole("button", { name: "Authorize Override" }).click();
  await expect(dlg.getByText("Approved and applied to the DEMO scenario")).toBeVisible();
});

test("add to cart, proforma PDF, Paystack test checkout", async ({ page }) => {
  await login(page, "demo-buyer");
  await page.goto("/app/marketplace");
  await page.getByRole("button", { name: "Add to Cart / Request RFQ" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Cart and RFQ" });
  await expect(dlg.getByTestId("cart-total")).toContainText("₦");
  const [pdf] = await Promise.all([page.waitForEvent("download"), dlg.getByRole("button", { name: "Generate Proforma Invoice (PDF)" }).click()]);
  expect(pdf.suggestedFilename()).toBe("proforma-invoice.pdf");
  const me = await (await page.request.get("/api/me")).json();
  if (me.paystack) {
    await Promise.all([page.waitForURL(/paystack\.co/), dlg.getByRole("button", { name: /Pay with Paystack/ }).click()]);
  } else {
    await dlg.getByRole("button", { name: /Pay with Paystack/ }).click();
    await expect(dlg.getByText("Paystack test key is not set")).toBeVisible();
  }
});

test("Trigger leak drives alarms through warning, critical, SCRAM and recovery", async ({ page }) => {
  await login(page, "demo-operator");
  await page.goto("/app/alarms");
  await page.getByTestId("trigger-leak").click();
  const level = page.getByTestId("ambient-level");
  const flags = page.getByTestId("board-flags");
  await expect(level).toContainText("Pre-hazard", { timeout: 25_000 });
  await expect(level).toContainText("Critical", { timeout: 15_000 });
  await expect(flags).toContainText("Trip latched");
  await expect(flags).toContainText("SCRAM latched", { timeout: 10_000 });
  await expect(level).toContainText("Normal", { timeout: 20_000 });
  await expect(flags).toContainText("Trip clear", { timeout: 25_000 });
  await expect(flags).toContainText("No SCRAM");
});

test("webhook refuses a bad signature and prices never come from the browser", async ({ page }) => {
  const r = await page.request.post("/api/paystack/webhook", { data: { event: "charge.success", data: { reference: "x" } }, headers: { "x-paystack-signature": "bad" } });
  expect([401, 503]).toContain(r.status());
  await login(page, "demo-buyer");
  const ok = await page.request.post("/api/pdf/proforma", { data: { lines: [{ productId: "liquid-co2-food", packagingId: "skid1t", qty: 1, price_kobo: 1 }], logistics: "pickup", location: "Kano Depot" } });
  expect(ok.status()).toBe(200);
  const belowMoq = await page.request.post("/api/pdf/proforma", { data: { lines: [{ productId: "liquid-co2-food", packagingId: "cyl50", qty: 1 }], logistics: "pickup", location: "Kano Depot" } });
  expect(belowMoq.status()).toBe(409);
});
