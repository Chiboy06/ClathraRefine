// DEMO scenario content from the build brief. Every figure here is Demo or Simulated and is tagged as such in the UI.
import type { Role } from "./roleMatrix";

export const DEMO_USERS: { id: string; name: string; email: string; role: Role }[] = [
  { id: "demo-viewer", name: "Chidi Okafor", email: "viewer@demo.clathrarefine.test", role: "viewer" },
  { id: "demo-operator", name: "Engr. T. Balogun", email: "operator@demo.clathrarefine.test", role: "operator" },
  { id: "demo-supervisor", name: "Ngozi Eze", email: "supervisor@demo.clathrarefine.test", role: "supervisor" },
  { id: "demo-supervisor-2", name: "Ibrahim Musa", email: "supervisor2@demo.clathrarefine.test", role: "supervisor" },
  { id: "demo-auditor", name: "Dr. Amina Bello", email: "auditor@demo.clathrarefine.test", role: "auditor" },
  { id: "demo-buyer", name: "Funke Adeyemi", email: "buyer@demo.clathrarefine.test", role: "buyer" },
  { id: "demo-seller", name: "Demo Seller Ltd", email: "seller@demo.clathrarefine.test", role: "seller" },
  { id: "demo-admin", name: "Platform Admin", email: "admin@demo.clathrarefine.test", role: "admin" },
];

export const FACILITY = {
  name: "Niger Delta Mini-Refinery Complex #04",
  station: "CLR-REF-NG-9842",
  location: "Port Harcourt, Rivers State",
  shift: "Shift Alpha • Engr. T. Balogun",
};

// ---------------- Plant ----------------
export const PLANT = {
  inletPct: 11.2,
  outletPct: 0.9,
  inletAdc: 3058,
  outletAdc: 245,
  ambientAdc: 410,
  flowM3h: 450,
  dpKpa: 1.82,
  leanPh: 12.4,
  richPh: 8.1,
  tempC: 42.4,
  captureKgH: 184.2,
  safetyScore: 98.4,
  flueGasPpm: 418,
  flueGasAdc: 1180,
  dailyCo2t: 4.82,
  dailySpotKobo: 409_700_000,
};

export const DEPARTMENTS = [
  { id: "cdu", name: "Crude Distillation (CDU)", gas: "Flue gas (CO2, SOx)", flowM3h: 1240, emissionKgH: 312.4, quotaMt: 900, usedMt: 562, status: "Running" },
  { id: "scrubber", name: "Gas Sweetening Scrubber", gas: "CO2, H2S", flowM3h: 450, emissionKgH: 14.8, quotaMt: 350, usedMt: 118, status: "Optimal" },
  { id: "flare", name: "Flare Recovery Knockout", gas: "Methane, VOCs", flowM3h: 380, emissionKgH: 96.1, quotaMt: 500, usedMt: 401, status: "Watch" },
  { id: "lpg", name: "LPG Bottling Depot", gas: "Propane, butane", flowM3h: 120, emissionKgH: 22.7, quotaMt: 250, usedMt: 96, status: "Running" },
  { id: "boiler", name: "Steam Boiler House", gas: "Flue gas (CO2, NOx)", flowM3h: 860, emissionKgH: 188.9, quotaMt: 500, usedMt: 243, status: "Maintenance due" },
] as const;
export const QUOTA = { monthlyMt: 2500, consumedPct: 56.8, surplusMt: 1080 };

export const SITES = [
  { id: "skid", name: "ClathraRefine bench skid", thing: "ESP32S3-N16R8-HARNESS-01", real: true, region: "eu-west-1" },
  { id: "demo-a", name: "Demo Site Alpha (fictional)", thing: "DEMO-ALPHA-01", real: false, region: "eu-west-1" },
  { id: "demo-b", name: "Demo Site Bravo (fictional)", thing: "DEMO-BRAVO-01", real: false, region: "eu-west-1" },
  { id: "demo-c", name: "Demo Site Charlie (fictional)", thing: "DEMO-CHARLIE-01", real: false, region: "eu-west-1" },
];

// ---------------- Marketplace ----------------
export type Packaging = { id: string; label: string; price_kobo: number; moq: number; mt_per_unit?: number };
export type Product = {
  id: string;
  created_at: number;
  seller_id: string;
  seller_name: string;
  title: string;
  category: string;
  packaging: Packaging[];
  default_qty: number;
  stock: number;
  stock_label: string;
  badges: string[];
  description: string;
  specs: string[];
  image: string;
  alt: string;
  status: "live" | "hidden" | "draft";
  demo: true;
  lot: { lot_id: string; site: string; period: string; tag: string };
  coa?: { label: string; value: string }[];
  secondary: "coa" | "spec" | "ledger" | "coa-solution";
};

export const CATEGORIES = [
  "All Fractions",
  "Liquid CO2 (Food/Cryo)",
  "Scrubbed Biomethane (Bio-CNG)",
  "Carbon Offsets (VCS)",
  "Specialty Syngas",
  "Recovered Chemicals",
] as const;

export const LOCATIONS = ["Lagos Industrial Zone (Ikeja)", "Port Harcourt Terminal", "Kano Depot"] as const;

const T0 = Date.UTC(2026, 9, 1);

export const PRODUCTS: Product[] = [
  {
    id: "liquid-co2-food",
    created_at: T0,
    seller_id: "demo-seller",
    seller_name: "Demo Seller Ltd",
    title: "Liquid CO2, food and beverage grade, 99.98% purity",
    category: "Liquid CO2 (Food/Cryo)",
    packaging: [
      { id: "cyl50", label: "50 L high-pressure cylinder", price_kobo: 4_500_000, moq: 2, mt_per_unit: 0.03 },
      { id: "skid1t", label: "1-ton skid", price_kobo: 12_000_000, moq: 1, mt_per_unit: 1 },
      { id: "tanker10t", label: "10-ton cryogenic road tanker", price_kobo: 85_000_000, moq: 1, mt_per_unit: 10 },
    ],
    default_qty: 2,
    stock: 42,
    stock_label: "In Stock (42.0 MT Reserve)",
    badges: ["Target: E290 food grade", "99.98% Pure", "In Stock (42.0 MT Reserve)"],
    description: "Direct solvent-scrubbed CO2, cryogenically purified for carbonated beverages, cold-chain dry ice and greenhouse enrichment.",
    specs: ["Moisture < 5 ppm", "Pressure 19.4 Bar", "Temp −21.8 °C"],
    image: "/images/co2-tanker.svg",
    alt: "Illustration of a vacuum-insulated cryogenic ISO tank on a road trailer",
    status: "live",
    demo: true,
    lot: { lot_id: "LOT-CO2-2026-1104", site: "Niger Delta Mini-Refinery Complex #04", period: "1 to 4 Nov 2026", tag: "AT-104" },
    coa: [
      { label: "CO2 purity", value: "99.98 % v/v" },
      { label: "Residual nitrogen", value: "112 ppm v/v" },
      { label: "Total hydrocarbons (as CH4)", value: "18 ppm v/v" },
      { label: "Moisture", value: "4.1 ppm v/v" },
      { label: "Sulphur compounds (as S)", value: "< 0.1 ppm v/v" },
    ],
    secondary: "coa",
  },
  {
    id: "biomethane-cng",
    created_at: T0 + 1,
    seller_id: "demo-seller",
    seller_name: "Demo Seller Ltd",
    title: "Upgraded biomethane / scrubber-derived CNG, 98.5% CH4",
    category: "Scrubbed Biomethane (Bio-CNG)",
    packaging: [{ id: "cascade250", label: "250 m3 cascade skid", price_kobo: 32_000_000, moq: 1 }],
    default_qty: 2,
    stock: 18,
    stock_label: "Immediate Dispatch",
    badges: ["Renewable Fuel Grade", "Desulfurized (< 2 ppm H2S)", "Immediate Dispatch"],
    description: "High-calorific CNG for turbine power generation and industrial boilers.",
    specs: ["Wobbe Index 49.8 MJ/m3", "Pressure 200 Bar", "Dew Point −40 °C"],
    image: "/images/cng-cascade.svg",
    alt: "Illustration of a 200-bar cylinder cascade trailer skid",
    status: "live",
    demo: true,
    lot: { lot_id: "LOT-CNG-2026-1102", site: "Niger Delta Mini-Refinery Complex #04", period: "28 Oct to 2 Nov 2026", tag: "FT-301" },
    coa: [
      { label: "Methane (CH4)", value: "98.5 % v/v" },
      { label: "Carbon dioxide", value: "0.9 % v/v" },
      { label: "Nitrogen", value: "0.5 % v/v" },
      { label: "Hydrogen sulphide", value: "< 2 ppm v/v" },
      { label: "Water dew point", value: "−40 °C at 200 bar" },
    ],
    secondary: "spec",
  },
  {
    id: "carbon-token",
    created_at: T0 + 2,
    seller_id: "demo-seller",
    seller_name: "Demo Seller Ltd",
    title: "Carbon offset tokens, 1 MT CO2e sequestration",
    category: "Carbon Offsets (VCS)",
    packaging: [{ id: "token1t", label: "Metric-ton token", price_kobo: 3_550_000, moq: 1, mt_per_unit: 1 }],
    default_qty: 10,
    stock: 1080,
    stock_label: "1,080 MT surplus",
    badges: ["Target: Verra / Gold Standard", "Audited Hardware Provenance"],
    description: "Carbon removal credit generated from the ESP32-S3-verified packed-bed scrubber.",
    specs: ["1 token = 1 MT CO2e", "Hash-chained provenance", "Retire on purchase"],
    image: "/images/carbon-badge.svg",
    alt: "Digital verification badge with a hash chain motif",
    status: "live",
    demo: true,
    lot: { lot_id: "LOT-CRB-2026-10", site: "Niger Delta Mini-Refinery Complex #04", period: "October 2026", tag: "FQ-501" },
    secondary: "ledger",
  },
  {
    id: "sodium-carbonate",
    created_at: T0 + 3,
    seller_id: "demo-seller",
    seller_name: "Demo Seller Ltd",
    title: "Sodium carbonate solution, recovered",
    category: "Recovered Chemicals",
    packaging: [{ id: "litre", label: "Per litre", price_kobo: 250_000, moq: 20 }],
    default_qty: 20,
    stock: 400,
    stock_label: "400 L available",
    badges: ["Recovered from solvent loop", "Lot traceable"],
    description: "Spent caustic from the skid's solvent loop, carbonated to sodium carbonate solution and sold by the litre.",
    specs: ["pH about 11", "Na2CO3 about 1.3 g/L", "Sealed HDPE drums"],
    image: "/images/carbonate-drum.svg",
    alt: "Illustration of sealed HDPE drums of sodium carbonate solution",
    status: "live",
    demo: true,
    lot: { lot_id: "LOT-NAC-2026-1105", site: "ClathraRefine bench skid", period: "5 Nov 2026", tag: "LT-401" },
    coa: [
      { label: "Sodium carbonate", value: "1.3 g/L" },
      { label: "Residual NaOH", value: "< 0.05 g/L" },
      { label: "pH", value: "11.1" },
      { label: "Suspended solids", value: "< 10 mg/L" },
      { label: "Sulphur compounds (as S)", value: "< 1 mg/L" },
    ],
    secondary: "coa-solution",
  },
];

export const LOGISTICS = [
  { id: "pickup", label: "Buyer Self-Pickup (Ex-Works Port Harcourt Depot)", kobo: 0 },
  { id: "tanker", label: "Dedicated Cryogenic Road Tanker Dispatch", kobo: 6_500_000 },
] as const;

export const TIERS = [
  { name: "Academic/Pilot Skid", kobo: 35_000_000, note: "/mo", popular: false, features: ["1 site, 1 controller", "LIVE and DEMO modes", "Marketplace listing (Demo)", "Email support"] },
  { name: "Modular Mini-Refinery", kobo: 125_000_000, note: "/mo", popular: true, features: ["Up to 5 sites", "Two-person override workflow", "Compliance archive and ZIP export", "24/7 field support desk"] },
  { name: "Enterprise Complex", kobo: null, note: "Custom SLA", popular: false, features: ["Unlimited sites", "Dedicated AWS account", "Custom alarm rationalisation", "On-site commissioning"] },
];

export const SPOT_RATES = [
  { product: "Liquid CO2 (food grade)", unit: "per MT", kobo: 12_000_000, terms: "Ex-Works Port Harcourt or tanker dispatch, 48 h" },
  { product: "Scrubbed Biomethane (Bio-CNG)", unit: "per 250 m3 skid", kobo: 32_000_000, terms: "Delivered within 150 km, 72 h" },
  { product: "Carbon offset token", unit: "per MT CO2e", kobo: 3_550_000, terms: "Retired on purchase, ledger entry on settlement" },
  { product: "Sodium carbonate solution", unit: "per litre", kobo: 250_000, terms: "Sealed drums, buyer collection" },
  { product: "Specialty Syngas", unit: "per Nm3", kobo: null, terms: "On request" },
];

// ---------------- Compliance ----------------
const day = 86_400_000;
const NOW_SEED = Date.UTC(2026, 10, 7, 9, 0);
export const AUDIT_HISTORY = [
  { id: "AUD-2026-0891", standard: "ISO 14064", auditor: "Dr. Amina Bello", unit: "Gas Sweetening Scrubber", score: 98.4, status: "In progress" },
  { id: "AUD-2026-0874", standard: "NESREA", auditor: "Dr. Amina Bello", unit: "Flare Recovery Knockout", score: 95.1, status: "Published" },
  { id: "AUD-2026-0852", standard: "OSHA 1910", auditor: "Engr. K. Danjuma", unit: "LPG Bottling Depot", score: 97.6, status: "Published" },
  { id: "AUD-2026-0833", standard: "ISO 14064", auditor: "Dr. Amina Bello", unit: "Crude Distillation (CDU)", score: 93.8, status: "Published" },
  { id: "AUD-2026-0819", standard: "NESREA", auditor: "Engr. K. Danjuma", unit: "Steam Boiler House", score: 91.2, status: "Corrective action" },
  { id: "AUD-2026-0801", standard: "ISO 14064", auditor: "Dr. Amina Bello", unit: "Gas Sweetening Scrubber", score: 99.0, status: "Published" },
].map((a, i) => ({ ...a, created_at: NOW_SEED - i * 9 * day, demo: true }));

// ---------------- Seeds for the in-memory store ----------------
const sid = (t: number, n: number) => `${t.toString().padStart(15, "0")}#seed${n}`;

export function seedFor(coll: string): Record<string, unknown>[] {
  switch (coll) {
    case "products":
      return PRODUCTS.map((p) => ({ ...p }));
    case "audits":
      return AUDIT_HISTORY.map((a) => ({
        ...a,
        id: a.id,
        sha256: null, // filled from the real PDF bytes on first listing
        locked: a.status !== "In progress",
      }));
    case "tickets":
      return [
        { id: sid(NOW_SEED - 3 * day, 1), created_at: NOW_SEED - 3 * day, category: "Sensor", severity: "Medium", description: "AT-101 baseline drifted 40 mV overnight.", status: "Resolved", by: "Engr. T. Balogun", demo: true },
        { id: sid(NOW_SEED - day, 2), created_at: NOW_SEED - day, category: "Relay", severity: "Low", description: "Yellow lamp relay clicks at reset.", status: "Open", by: "Engr. T. Balogun", demo: true },
      ];
    case "shift":
      return [
        { id: sid(NOW_SEED - 8 * 3_600_000, 1), created_at: NOW_SEED - 8 * 3_600_000, shift: "Shift Charlie", author: "Ibrahim Musa", note: "Solvent topped up to 2.0 L. pH 12.4 at handover.", handover: true, accepted_by: "Engr. T. Balogun", demo: true },
        { id: sid(NOW_SEED - 2 * 3_600_000, 2), created_at: NOW_SEED - 2 * 3_600_000, shift: "Shift Alpha", author: "Engr. T. Balogun", note: "Warm-up completed 06:03 UTC. Ambient baseline 483 mV.", handover: false, demo: true },
      ];
    case "sites":
      return SITES.map((s, i) => ({ ...s, id: s.id, created_at: T0 + i }));
    case "settings":
      return [{ id: "usd_ngn_rate", created_at: T0, value: 1450 }, { id: "display_warn_mv", created_at: T0, value: 1410 }, { id: "display_crit_mv", created_at: T0, value: 2710 }];
    case "ledger":
      return [];
    default:
      return [];
  }
}
