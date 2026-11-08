// Capture lots: what the scrubber produced, where and when. Listings start from a lot. Demo data.
export type CaptureLot = { lot_id: string; product: string; category: string; site: string; from: string; to: string; quantity: string; tag: string; suggested: { title: string; packaging_label: string; price_naira: number; moq: number; stock: number } };

export const CAPTURE_LOTS: CaptureLot[] = [
  { lot_id: "LOT-CO2-2026-1104", product: "Liquid CO2, food grade", category: "Liquid CO2 (Food/Cryo)", site: "Niger Delta Mini-Refinery Complex #04", from: "1 Nov 2026", to: "4 Nov 2026", quantity: "42.0 MT", tag: "AT-104", suggested: { title: "Liquid CO2, 1-ton skid", packaging_label: "1-ton skid", price_naira: 120_000, moq: 1, stock: 42 } },
  { lot_id: "LOT-CNG-2026-1102", product: "Scrubbed biomethane", category: "Scrubbed Biomethane (Bio-CNG)", site: "Niger Delta Mini-Refinery Complex #04", from: "28 Oct 2026", to: "2 Nov 2026", quantity: "18 cascade skids", tag: "FT-301", suggested: { title: "Bio-CNG, 250 m3 cascade skid", packaging_label: "250 m3 cascade skid", price_naira: 320_000, moq: 1, stock: 18 } },
  { lot_id: "LOT-CRB-2026-10", product: "Carbon removal tokens", category: "Carbon Offsets (VCS)", site: "Niger Delta Mini-Refinery Complex #04", from: "1 Oct 2026", to: "31 Oct 2026", quantity: "1,080 MT CO2e", tag: "FQ-501", suggested: { title: "Carbon offset tokens, October lot", packaging_label: "Metric-ton token", price_naira: 35_500, moq: 1, stock: 1080 } },
  { lot_id: "LOT-NAC-2026-1105", product: "Sodium carbonate solution", category: "Recovered Chemicals", site: "Bench scrubber skid", from: "5 Nov 2026", to: "5 Nov 2026", quantity: "400 L", tag: "LT-401", suggested: { title: "Sodium carbonate solution, per litre", packaging_label: "Per litre", price_naira: 2_500, moq: 20, stock: 400 } },
];

export const lotById = (id: string | null) => CAPTURE_LOTS.find((l) => l.lot_id === id);
