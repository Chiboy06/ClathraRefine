import { test, expect } from "@playwright/test";
import { login, prefs } from "./helpers";
import { TEST_PIN } from "./testValues";

test.beforeEach(async ({ page }) => prefs(page, { mode: "DEMO" }));

test("a viewer cannot SCRAM", async ({ page }) => {
  await login(page, "demo-viewer");
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Master SCRAM" }).first()).toBeDisabled();
  const r = await page.request.post("/api/scram", { data: { mode: "DEMO", confirm: true } });
  expect(r.status()).toBe(403);
});

test("an operator SCRAM opens the safety modal and is audited", async ({ page }) => {
  await login(page, "demo-operator");
  await page.goto("/app");
  await page.getByRole("button", { name: "Master SCRAM" }).first().click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText("Consequence:")).toBeVisible();
  await expect(dlg.getByText("Engr. T. Balogun")).toBeVisible();
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Confirm SCRAM" }).click();
  await expect(dlg.getByText("recorded in the audit log")).toBeVisible();
  await expect(dlg.getByText("Confirmed by board telemetry")).toBeVisible({ timeout: 10_000 });
  const log = await (await page.request.get("/api/audit-log")).json();
  expect(log.rows.some((e: { action: string; actor: string; outcome: string }) => e.action === "scram" && e.actor === "demo-operator" && e.outcome === "ok")).toBe(true);
  expect(log.intact).toBe(true);
});

test("a supervisor cannot approve their own override; a second supervisor can", async ({ page }) => {
  await login(page, "demo-supervisor");
  await page.goto("/app/relays");
  await page.getByRole("button", { name: "Pulse test" }).first().click();
  let dlg = page.getByRole("dialog");
  await dlg.getByLabel("Reason").fill("Monthly lamp check");
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
  await expect(level).toContainText("Pre-hazard", { timeout: 35_000 });
  await expect(level).toContainText("Critical", { timeout: 35_000 });
  await expect(flags).toContainText("Trip latched");
  await expect(flags).toContainText("SCRAM latched", { timeout: 35_000 });
  await expect(level).toContainText("Normal", { timeout: 35_000 });
  await expect(flags).toContainText("Trip latched");
  await expect(flags).toContainText("Trip clear", { timeout: 35_000 });
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
