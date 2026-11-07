import { describe, expect, it } from "vitest";
import { captureRateKgH, DEMO_CAPTURE, removalEfficiency, solventCapacityGPerL, adcToMv, mvToAdc, pctToPpm, simulateCapture } from "./process";
import { formatMoney, formatConc, koboToCurrency } from "./format";
import { alarmReduce, newAlarm, bannerAlarm, isChattering } from "./alarms";
import { quality } from "./quality";
import { approvalError } from "./twoPerson";
import { lttb } from "./lttb";
import { initialBoard, stepBoard, relayOn } from "./fsm";
import { chainHash, verifyChain } from "./chain";

describe("process", () => {
  it("removal efficiency is 91.96% for the demo values", () => {
    expect(removalEfficiency(11.2, 0.9).toFixed(2)).toBe("91.96");
  });
  it("capture rate is 184.2 kg/h with the demo inputs", () => {
    expect(captureRateKgH(DEMO_CAPTURE).toFixed(1)).toBe("184.2");
  });
  it("0.025 M NaOH holds about 0.55 g CO2 per litre to carbonate", () => {
    expect(solventCapacityGPerL(0.025)).toBeCloseTo(0.55, 2);
  });
  it("simulator loads the solvent and outlet rises as it saturates", () => {
    const run = simulateCapture(120);
    expect(run[0].outletPct).toBeCloseTo(0.4, 2);
    expect(run[120].loadingPct).toBeGreaterThan(run[60].loadingPct);
    expect(run[120].outletPct).toBeGreaterThan(run[0].outletPct);
  });
  it("ADC and mV scale with the guide factor", () => {
    expect(adcToMv(1200)).toBe(1414);
    expect(mvToAdc(2710)).toBe(2301);
  });
});

describe("unit and currency conversion", () => {
  it("vol % and ppm", () => {
    expect(pctToPpm(11.2)).toBe(112_000);
    expect(formatConc(0.9, "PPM")).toBe("9,000 PPM");
    expect(formatConc(11.2, "PCT")).toBe("11.2% Vol");
  });
  it("kobo to NGN and USD at the rate setting", () => {
    expect(formatMoney(4_500_000, "NGN")).toBe("₦45,000");
    expect(formatMoney(4_500_000, "USD")).toBe("$31.03");
    expect(koboToCurrency(145_000, "USD", 1450)).toBe(1);
  });
});

describe("alarm state machine", () => {
  const a0 = newAlarm("A1", "AT-101", "critical", "Ambient critical");
  it("active, ack, clear goes back to normal", () => {
    let a = alarmReduce(a0, { type: "condition", active: true, value: 2800, now: 1 });
    expect(a.state).toBe("UNACK_ACTIVE");
    a = alarmReduce(a, { type: "ack", by: "op" });
    expect(a.state).toBe("ACK_ACTIVE");
    a = alarmReduce(a, { type: "condition", active: false, value: 500, now: 2 });
    expect(a.state).toBe("NORMAL");
  });
  it("clear before ack is returned unacknowledged", () => {
    let a = alarmReduce(a0, { type: "condition", active: true, value: 2800, now: 1 });
    a = alarmReduce(a, { type: "condition", active: false, value: 500, now: 2 });
    expect(a.state).toBe("RTN_UNACK");
    expect(bannerAlarm([a]).count).toBe(1);
    expect(alarmReduce(a, { type: "ack", by: "op" }).state).toBe("NORMAL");
  });
  it("shelving needs a reason and expires", () => {
    const act = alarmReduce(a0, { type: "condition", active: true, value: 2800, now: 1 });
    expect(alarmReduce(act, { type: "shelve", reason: " ", until: 10 }).state).toBe("UNACK_ACTIVE");
    const sh = alarmReduce(act, { type: "shelve", reason: "Maintenance", until: 10 });
    expect(sh.state).toBe("SHELVED");
    expect(alarmReduce(sh, { type: "tick", now: 11 }).state).toBe("UNACK_ACTIVE");
  });
  it("suppressed during warm-up", () => {
    const a = alarmReduce(a0, { type: "condition", active: true, value: 2800, now: 1, suppressed: true });
    expect(a.state).toBe("SUPPRESSED");
    expect(alarmReduce(a, { type: "tick", now: 2, suppressed: false }).state).toBe("UNACK_ACTIVE");
  });
  it("chattering is 3 activations in a minute", () => {
    expect(isChattering([0, 10_000, 20_000], 30_000)).toBe(true);
    expect(isChattering([0, 10_000], 30_000)).toBe(false);
  });
});

describe("quality and staleness", () => {
  it("ranks Bad, Stale, Uncertain, Good", () => {
    expect(quality({ mv: 50, updatedAt: 0 }, 1)).toBe("Bad");
    expect(quality({ mv: 500, sensorFault: true, updatedAt: 0 }, 1)).toBe("Bad");
    expect(quality({ mv: 500, updatedAt: 0 }, 10_001)).toBe("Stale");
    expect(quality({ mv: 500, warmingUp: true, updatedAt: 0 }, 1)).toBe("Uncertain");
    expect(quality({ mv: 500, buffered: true, updatedAt: 0 }, 1)).toBe("Uncertain");
    expect(quality({ mv: 500, updatedAt: 0 }, 10_000)).toBe("Good");
  });
});

describe("two-person rule", () => {
  const req = { request_id: "r1", requested_by: "sup-a", status: "pending" as const };
  it("refuses self-approval, non-supervisors and non-pending", () => {
    expect(approvalError(req, "sup-a", "supervisor")).toMatch(/different/);
    expect(approvalError(req, "sup-a", "admin")).toMatch(/different/);
    expect(approvalError(req, "op", "operator")).toMatch(/supervisor/);
    expect(approvalError({ ...req, status: "approved" }, "sup-b", "supervisor")).toMatch(/pending/);
    expect(approvalError(undefined, "sup-b", "supervisor")).toMatch(/not found/);
  });
  it("allows a different supervisor", () => {
    expect(approvalError(req, "sup-b", "supervisor")).toBeNull();
  });
});

describe("lttb", () => {
  it("keeps ends and reduces to threshold", () => {
    const d = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: Math.sin(i / 20) }));
    const out = lttb(d, 100, (p) => p.x, (p) => p.y);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(d[0]);
    expect(out[99]).toBe(d[999]);
  });
});

describe("firmware port", () => {
  it("stagger 2 s then purge 5 s", () => {
    let s = initialBoard();
    const t0 = 200_000;
    s = stepBoard(s, { uptimeMs: t0, exhaustMv: 2000, ambientMv: 500 });
    expect(s.scrubber).toBe("INTAKE_ACTIVE");
    expect(relayOn(s.relayMask, 1)).toBe(true);
    expect(relayOn(s.relayMask, 2)).toBe(false);
    s = stepBoard(s, { uptimeMs: t0 + 2000, exhaustMv: 2000, ambientMv: 500 });
    expect(s.scrubber).toBe("SCRUBBING");
    expect(relayOn(s.relayMask, 2)).toBe(true);
    s = stepBoard(s, { uptimeMs: t0 + 3000, exhaustMv: 1600, ambientMv: 500 });
    expect(s.scrubber).toBe("PURGING");
    s = stepBoard(s, { uptimeMs: t0 + 8000, exhaustMv: 1600, ambientMv: 500 });
    expect(s.scrubber).toBe("IDLE");
    expect(s.relayMask & 0b11).toBe(0);
  });
  it("trip latches and only ACK at NORMAL resets it", () => {
    let s = initialBoard();
    s = stepBoard(s, { uptimeMs: 200_000, exhaustMv: 500, ambientMv: 2800 });
    expect(s.tripLatched).toBe(true);
    expect(relayOn(s.relayMask, 6)).toBe(true);
    s = stepBoard(s, { uptimeMs: 200_100, exhaustMv: 500, ambientMv: 2800, ackPressed: true });
    expect(s.sirenSilenced).toBe(true);
    expect(s.tripLatched).toBe(true);
    s = stepBoard(s, { uptimeMs: 200_200, exhaustMv: 500, ambientMv: 900 });
    expect(s.level).toBe("NORMAL");
    expect(s.tripLatched).toBe(true);
    s = stepBoard(s, { uptimeMs: 200_300, exhaustMv: 500, ambientMv: 900, ackPressed: true });
    expect(s.tripLatched).toBe(false);
    expect(relayOn(s.relayMask, 4)).toBe(true);
  });
  it("no trips during warm-up", () => {
    const s = stepBoard(initialBoard(), { uptimeMs: 1000, exhaustMv: 3000, ambientMv: 3000 });
    expect(s.tripLatched).toBe(false);
    expect(relayOn(s.relayMask, 5)).toBe(true);
  });
});

describe("hash chain", () => {
  it("detects tampering", async () => {
    const a = await chainHash("GENESIS", { n: 1 });
    const b = await chainHash(a, { n: 2 });
    const entries = [
      { prev: "GENESIS", hash: a, body: { n: 1 } },
      { prev: a, hash: b, body: { n: 2 } },
    ];
    expect(await verifyChain(entries)).toBe(true);
    entries[0].body.n = 9;
    expect(await verifyChain(entries)).toBe(false);
  });
});

import { priceCart } from "./cart";
import { PRODUCTS } from "./demoData";

describe("cart pricing", () => {
  it("prices from records, adds VAT, credits ESG and applies the 50 MT rebate", () => {
    const r = priceCart(
      [
        { productId: "liquid-co2-food", packagingId: "skid1t", qty: 2 },
        { productId: "carbon-token", packagingId: "token1t", qty: 60 },
      ],
      PRODUCTS,
      "tanker",
    );
    expect(r.errors).toEqual([]);
    expect(r.lines[0].subtotal_kobo).toBe(24_000_000);
    expect(r.lines[1].rebate_kobo).toBe(Math.round(60 * 3_550_000 * 0.12));
    const sub = 24_000_000 + 60 * 3_550_000 - r.lines[1].rebate_kobo;
    expect(r.subtotal).toBe(sub);
    expect(r.vat).toBe(Math.round((sub + 6_500_000) * 0.075));
    expect(r.esgCredit).toBe(Math.round(r.lines[1].subtotal_kobo * 0.075));
    expect(r.total).toBe(sub + 6_500_000 + r.vat - r.esgCredit);
  });
  it("refuses below MOQ and unknown items", () => {
    const r = priceCart([{ productId: "liquid-co2-food", packagingId: "cyl50", qty: 1 }, { productId: "nope", packagingId: "x", qty: 1 }], PRODUCTS, "pickup");
    expect(r.errors).toHaveLength(2);
  });
});
