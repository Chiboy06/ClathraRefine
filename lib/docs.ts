// Document content for PDFs. Kept as data so the same text feeds the library downloads and reports.
import type { DocSpec } from "./server/pdf";
import { FACILITY, PLANT, PRODUCTS, type Product } from "./demoData";
import { formatMoney } from "./format";
import { FW, captureRateKgH, DEMO_CAPTURE, removalEfficiency } from "./process";
import { TAGS } from "./tags";
import type { priceCart } from "./cart";

export const LIBRARY: Record<string, DocSpec> = {
  wiring: {
    title: "ESP32-S3 Wiring Schematics",
    subtitle: "ClathraRefine rev B harness, ESP32-S3-WROOM-1-N16R8",
    sections: [
      {
        heading: "Pin map",
        table: {
          head: ["Board pin", "Connected to", "Type"],
          rows: [
            ["GPIO1", "MQ-2 exhaust analogue output (10k/15k divider)", "ADC1 input"],
            ["GPIO2", "MQ-2 ambient analogue output (10k/15k divider)", "ADC1 input"],
            ["GPIO4", "Acknowledge push button to GND", "Input, internal pull-up"],
            ["GPIO6", "Relay 1, air intake fan", "Output, active LOW"],
            ["GPIO7", "Relay 2, CO2 / solvent pump", "Output, active LOW"],
            ["GPIO8", "Relay 3, red hazard strobe", "Output, active LOW"],
            ["GPIO9", "Relay 4, green normal lamp", "Output, active LOW"],
            ["GPIO10", "Relay 5, yellow pre-hazard lamp", "Output, active LOW"],
            ["GPIO11", "Relay 6, siren horn 110 dB", "Output, active LOW"],
          ],
        },
      },
      {
        heading: "Divider",
        paragraphs: [
          "Vpin = Vsensor x 15 / (10 + 15). 5.0 V at the sensor gives 3.0 V at the pin, inside the 0 to 3,100 mV range at 11 dB attenuation.",
          "The firmware multiplies the pin reading by 25/15 to recover sensor millivolts. Use 1% resistors.",
        ],
      },
      {
        heading: "Notes",
        paragraphs: [
          "All pins avoid the octal PSRAM lines (GPIO35 to 37), strapping pins (GPIO0, 3, 45, 46) and USB pins (GPIO19, 20).",
          "Power the MQ-2 heaters from the 5 V supply, not from a board pin. Check each active-LOW relay releases when its pin is HIGH.",
        ],
      },
    ],
  },
  sds: {
    title: "Solvent SDS Sheet: dilute sodium hydroxide (0.025 M)",
    subtitle: "Summary for the bench skid. Read the supplier's full SDS before use.",
    sections: [
      { heading: "Identification", paragraphs: ["Sodium hydroxide solution, about 0.025 M (pH about 12.4). Used as the CO2 absorbent in the packed column."] },
      { heading: "Hazards", paragraphs: ["Causes eye and skin irritation; concentrated NaOH causes severe burns. Wear nitrile gloves and splash goggles."] },
      { heading: "First aid", paragraphs: ["Eyes or skin: rinse with clean water for at least 15 minutes and get first aid. Swallowed: rinse mouth, do not induce vomiting, get medical help."] },
      { heading: "Handling and storage", paragraphs: ["Keep sealed and labelled in HDPE. Store away from acids and aluminium. Do not fly with NaOH pellets."] },
      { heading: "Disposal", paragraphs: ["Neutralise and dispose of as the venue or department directs. Spent solution is sodium carbonate / bicarbonate."] },
    ],
  },
  ndir: {
    title: "NDIR Calibration Curves (template)",
    subtitle: "For a future infrared CO2 analyser. The MQ-2 sensors fitted today do not measure CO2.",
    sections: [
      {
        heading: "Status",
        paragraphs: [
          "No NDIR sensor is fitted yet. All CO2 values in the platform are Simulated. This template records the calibration points to capture when an NDIR analyser (0 to 10,000 ppm range) is added.",
        ],
      },
      {
        heading: "Calibration points to record",
        table: {
          head: ["Reference gas (ppm CO2)", "Sensor output", "Deviation", "Pass band"],
          rows: [
            ["0 (N2 zero)", "", "", "+/- 30 ppm"],
            ["400 (ambient)", "", "", "+/- 30 ppm"],
            ["5,000", "", "", "+/- 3% reading"],
            ["10,000", "", "", "+/- 3% reading"],
          ],
        },
      },
    ],
  },
  rbac: {
    title: "Clerk RBAC Matrix",
    subtitle: "Roles live in Clerk public metadata and are checked on the server for every route.",
    sections: [
      {
        heading: "Roles",
        table: {
          head: ["Role", "Can do"],
          rows: [
            ["viewer", "Read live readings, events and the marketplace"],
            ["operator", "Read, SCRAM, acknowledge alarms, request overrides"],
            ["supervisor", "Operator rights plus approve overrides, never their own"],
            ["auditor", "Read and run audits, publish reports"],
            ["buyer", "Read and buy in the marketplace"],
            ["seller", "Buyer rights plus list products and manage incoming orders"],
            ["admin", "Everything except approving their own overrides"],
          ],
        },
      },
      {
        heading: "Two-person rule",
        paragraphs: [
          "Relay overrides, pulse tests, manual mode and setting changes need a second, different supervisor. The supervisor PIN is checked against a bcrypt hash on the server; the database refuses approval by the requester.",
          "SCRAM is one confirmed click for an operator or above, because an emergency stop must not wait for a second person.",
        ],
      },
    ],
  },
};

export function coaDoc(p: Product): DocSpec {
  return {
    title: `Certificate of Analysis: ${p.title}`,
    subtitle: `Lot ${p.lot.lot_id} | ${p.lot.site} | ${p.lot.period}`,
    meta: [
      ["Seller", p.seller_name],
      ["Source tag", p.lot.tag],
      ["Status", "Demo listing. Certifications shown are target standards."],
    ],
    sections: [
      { heading: "Gas chromatography breakdown (Demo)", table: { head: ["Component", "Result"], rows: (p.coa ?? []).map((r) => [r.label, r.value]) } },
      { heading: "Target standards", paragraphs: [p.badges.filter((b) => b.startsWith("Target")).join(", ") || "None declared"] },
    ],
    footer: "Signed with the platform document hash below.",
  };
}

export function specDoc(p: Product): DocSpec {
  return {
    title: `Fuel Spec Sheet: ${p.title}`,
    subtitle: `Lot ${p.lot.lot_id} | ${p.lot.period}`,
    sections: [
      { heading: "Specification (Demo)", table: { head: ["Property", "Value"], rows: p.specs.map((x) => x.split(/ (?=[\d<−-])/)).map(([a, ...b]) => [a, b.join(" ")]) } },
      { heading: "Composition (Demo)", table: { head: ["Component", "Result"], rows: (p.coa ?? []).map((r) => [r.label, r.value]) } },
      { heading: "Packaging", table: { head: ["Option", "Price"], rows: p.packaging.map((k) => [k.label, formatMoney(k.price_kobo, "NGN")]) } },
    ],
  };
}

export function proformaDoc(priced: ReturnType<typeof priceCart>, buyer: string, location: string, logistics: string): DocSpec {
  const m = (k: number) => formatMoney(k, "NGN");
  return {
    title: "Proforma Invoice",
    subtitle: `Issued to ${buyer} | Delivery: ${location}`,
    meta: [
      ["Invoice ref", `PF-${Date.now().toString(36).toUpperCase()}`],
      ["Logistics", logistics],
      ["Settlement", "Planned: audited Nigerian banking escrow. Demo uses Paystack test mode."],
    ],
    sections: [
      {
        heading: "Itemised manifest",
        table: {
          head: ["Product", "Packaging", "Qty", "Unit price", "Subtotal"],
          rows: priced.lines.map((l) => [l.title, l.packaging, String(l.qty), m(l.unit_kobo), m(l.subtotal_kobo) + (l.rebate_kobo ? ` (rebate ${m(l.rebate_kobo)})` : "")]),
        },
      },
      {
        heading: "Pricing summary",
        table: {
          head: ["Item", "Amount"],
          rows: [
            ["Subtotal", m(priced.subtotal)],
            ["Logistics", m(priced.logistics)],
            ["VAT 7.5%", m(priced.vat)],
            ["ESG tax exemption credits", `-${m(priced.esgCredit)}`],
            ["Total due", m(priced.total)],
          ],
        },
      },
      { heading: "Terms", paragraphs: ["Prices are computed on the server from the product database. Listings are Demo. Valid 7 days."] },
    ],
  };
}

export type AuditRecord = {
  id: string;
  standard: string;
  auditor: string;
  unit: string;
  score: number;
  status: string;
  created_at: number;
  solvent_ph?: number;
  flange_result?: string;
  notes?: string;
  signature?: string;
  photos?: { key: string; name: string }[];
  diagnostics?: { name: string; value: string; pass: boolean }[];
};

export function auditDoc(a: AuditRecord): DocSpec {
  return {
    title: `${a.standard} Audit Report ${a.id}`,
    subtitle: `${a.unit} | ${FACILITY.name}`,
    meta: [
      ["Lead auditor", `${a.auditor} (Demo persona)`],
      ["Score", `${a.score}%`],
      ["Status", a.status],
      ["Date", new Date(a.created_at).toISOString().slice(0, 10)],
      ["Standard", a.standard === "OSHA 1910" ? "OSHA 1910 (template; US law, Nigerian references NUPRC, NMDPRA, NESREA)" : `${a.standard} (target alignment)`],
    ],
    sections: [
      {
        heading: "Hardware loop diagnostic",
        table: { head: ["Check", "Result", "Pass"], rows: (a.diagnostics ?? []).map((d) => [d.name, d.value, d.pass ? "PASS" : "FAIL"]) },
      },
      {
        heading: "Field observations",
        paragraphs: [
          `Solvent pH: ${a.solvent_ph ?? "not recorded"}`,
          `Flange gasket ultrasonic leak test: ${a.flange_result ?? "not recorded"}`,
          `Thermal photos: ${(a.photos ?? []).map((p) => p.name).join(", ") || "none"}`,
          a.notes || "No further notes.",
        ],
      },
      { heading: "Sign-off", paragraphs: [`Signed: ${a.signature || a.auditor}`] },
    ],
  };
}

export function reportDoc(period: "daily" | "weekly"): DocSpec {
  const days = period === "daily" ? 1 : 7;
  return {
    title: `${period === "daily" ? "Daily" : "Weekly"} Plant Summary`,
    subtitle: `${FACILITY.name} | Demo scenario figures`,
    sections: [
      {
        heading: "Process (Simulated)",
        table: {
          head: ["Metric", "Value"],
          rows: [
            ["Inlet CO2", `${PLANT.inletPct}% Vol`],
            ["Outlet CO2", `${PLANT.outletPct}% Vol`],
            ["Removal efficiency", `${removalEfficiency(PLANT.inletPct, PLANT.outletPct).toFixed(2)}%`],
            ["Capture rate", `${captureRateKgH(DEMO_CAPTURE).toFixed(1)} kg/h`],
            ["CO2 captured", `${(PLANT.dailyCo2t * days).toFixed(2)} tCO2e`],
          ],
        },
      },
      {
        heading: "Safety thresholds (firmware, sensor mV)",
        table: {
          head: ["Threshold", "On", "Off"],
          rows: [
            ["Exhaust scrubber start", `${FW.EXH_ON_MV}`, `${FW.EXH_OFF_MV}`],
            ["Ambient warning", `${FW.AMB_WARN_ON_MV}`, `${FW.AMB_WARN_OFF_MV}`],
            ["Ambient critical trip", `${FW.AMB_CRIT_ON_MV}`, `${FW.AMB_CRIT_OFF_MV}`],
          ],
        },
      },
      { heading: "Tags", table: { head: ["Tag", "Name", "Source"], rows: TAGS.map((t) => [t.id, t.name, t.source === "board" ? "Board" : "Simulated"]) } },
    ],
  };
}

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
