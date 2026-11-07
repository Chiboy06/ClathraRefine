// ISA-5.1 style tag list. "board" tags come from the ESP32-S3 in LIVE mode; "sim" tags are always the DEMO scenario.
export type Tag = {
  id: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  normal: [number, number];
  lo?: number;
  hi?: number;
  hihi?: number;
  source: "board" | "sim";
  definition: string;
};

export const TAGS: Tag[] = [
  { id: "AT-101", name: "Ambient analyser (MQ-2, GPIO 2)", unit: "mV", min: 0, max: 5000, normal: [100, 1310], hi: 1410, hihi: 2710, source: "board", definition: "Ambient MQ-2 sensor-side millivolts. Warning at 1,410 mV, critical trip at 2,710 mV, with 100 mV hysteresis. Below 100 mV means check sensor." },
  { id: "AT-102", name: "Exhaust analyser (MQ-2, GPIO 1)", unit: "mV", min: 0, max: 5000, normal: [100, 1670], hi: 1770, source: "board", definition: "Exhaust MQ-2 sensor-side millivolts. Scrubber sequence starts at 1,770 mV and stops at 1,670 mV." },
  { id: "AT-103", name: "Inlet CO2 analyser (C_in)", unit: "% Vol", min: 0, max: 15, normal: [9, 12.5], hi: 13, source: "sim", definition: "Flue gas CO2 at the absorber inlet. Simulated: the MQ-2 does not measure CO2." },
  { id: "AT-104", name: "Outlet CO2 analyser (C_out)", unit: "% Vol", min: 0, max: 3, normal: [0, 1.2], hi: 1.5, hihi: 2.5, source: "sim", definition: "CO2 after the post-scrubber demister. Simulated." },
  { id: "FT-301", name: "Flue gas flow", unit: "m3/h", min: 0, max: 600, normal: [380, 520], lo: 300, hi: 560, source: "sim", definition: "Volumetric gas flow into the packed absorption column. Simulated." },
  { id: "PDT-302", name: "Column differential pressure", unit: "kPa", min: 0, max: 4, normal: [1.2, 2.4], hi: 2.8, hihi: 3.4, source: "sim", definition: "Pressure drop across the packed bed. A rising ΔP indicates flooding or fouling. Simulated." },
  { id: "TT-303", name: "Column temperature", unit: "°C", min: 0, max: 80, normal: [35, 50], hi: 55, hihi: 65, source: "sim", definition: "Absorber liquid temperature. Simulated." },
  { id: "AIT-304", name: "Lean solvent pH", unit: "pH", min: 7, max: 14, normal: [12, 13], lo: 11.5, source: "sim", definition: "pH of fresh 0.025 M NaOH. Simulated." },
  { id: "AIT-305", name: "Rich solvent pH", unit: "pH", min: 7, max: 14, normal: [7.8, 11], lo: 7.8, source: "sim", definition: "pH of loaded solvent. Near 8 the solution is in the bicarbonate region. Simulated." },
  { id: "LT-401", name: "Solvent loading", unit: "%", min: 0, max: 100, normal: [0, 80], hi: 85, hihi: 95, source: "sim", definition: "Share of the 0.55 g/L carbonate capacity used. Simulated." },
  { id: "FQ-501", name: "CO2 capture rate", unit: "kg/h", min: 0, max: 300, normal: [150, 220], lo: 120, source: "sim", definition: "ṁ = (P × Q / (R × T)) × (y_in − y_out) × M_CO2. Calculated from simulated inputs." },
  { id: "XV-201", name: "Air intake fan (relay 1, GPIO 6)", unit: "state", min: 0, max: 1, normal: [0, 1], source: "board", definition: "Extraction fan. On at scrubber start and during SCRAM." },
  { id: "P-202", name: "CO2 liquid pump (relay 2, GPIO 7)", unit: "state", min: 0, max: 1, normal: [0, 1], source: "board", definition: "Solvent pump. Starts 2.0 s after the fan; runs a 5.0 s purge after gas clears; stops on SCRAM." },
  { id: "XL-203", name: "Red hazard strobe (relay 3, GPIO 8)", unit: "state", min: 0, max: 1, normal: [0, 0], source: "board", definition: "On while a trip is latched." },
  { id: "XL-204", name: "Green normal lamp (relay 4, GPIO 9)", unit: "state", min: 0, max: 1, normal: [1, 1], source: "board", definition: "On when the ambient level is NORMAL and warm-up is complete." },
  { id: "XL-205", name: "Yellow pre-hazard lamp (relay 5, GPIO 10)", unit: "state", min: 0, max: 1, normal: [0, 0], source: "board", definition: "On during warm-up and at WARNING." },
  { id: "XA-206", name: "Siren horn 110 dB (relay 6, GPIO 11)", unit: "state", min: 0, max: 1, normal: [0, 0], source: "board", definition: "On while a trip is latched and not silenced by the first ACK press." },
  { id: "HS-001", name: "Master SCRAM", unit: "state", min: 0, max: 1, normal: [0, 0], source: "board", definition: "Cloud SCRAM latch. Pump off, fan on, red and siren on. Clears only with the physical ACK button once readings are NORMAL." },
];

export const tag = (id: string) => TAGS.find((t) => t.id === id)!;
export const RELAY_TAGS = ["XV-201", "P-202", "XL-203", "XL-204", "XL-205", "XA-206"];
