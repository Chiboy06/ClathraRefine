// Marketing copy. Plain, specific, benefit-led. No invented customers, awards or certifications.

export const SITE = {
  name: "ClathraRefine",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://clathrarefine.vercel.app",
  tagline: "See gas hazards coming. Stop leaks at the source. Turn captured carbon into revenue.",
  description:
    "ClathraRefine predicts gas hazards before they cross an alarm threshold, stops leaks at the source with an edge controller that acts in milliseconds, captures CO2 with a liquid-solvent scrubber, and sells what it captures with the production data behind every lot.",
};

export const CAPABILITIES = [
  { value: "2 s", label: "A reading from every sensor, every 2 seconds" },
  { value: "30 s", label: "Forecast horizon ahead of the alarm" },
  { value: "Local", label: "Trip response on the controller, with or without the network" },
  { value: "2.3 h", label: "Offline buffer, uploaded when the link returns" },
];

export const PILOT = [
  { value: "4,820 MT", label: "CO2 abated" },
  { value: "98.7%", label: "Sweetening yield" },
  { value: "₦18.4M", label: "Revenue generated" },
  { value: "99.98%", label: "Interlock uptime" },
];

export type ProductPage = {
  slug: "prediction" | "prevention" | "capture" | "marketplace";
  name: string;
  title: string;
  lead: string;
  shot: { src: string; alt: string };
  sections: { h: string; p: string; points?: string[] }[];
  limits?: { can: string[]; cannot: string[] };
};

export const PRODUCTS_PAGES: ProductPage[] = [
  {
    slug: "prediction",
    name: "Prediction",
    title: "Know a leak is coming before the alarm",
    lead: "ClathraRefine reads every gas sensor every 2 seconds, forecasts the next 30 seconds and scores how unusual the reading is. Your team sees the crossing coming while there is still time to act.",
    shot: { src: "/images/product/predict.png", alt: "Hazard prediction page with a risk index, a 30 second forecast line crossing the trip threshold ahead of the reading, and an anomaly panel" },
    sections: [
      { h: "A risk index you can read at a glance", p: "One number from 0 to 100 blends where the reading sits against its alarm limits, how fast it is rising, how unusual it is and where the forecast says it is heading." },
      { h: "Forecast and anomaly detection", p: "A short-term forecaster predicts the ambient reading 30 seconds ahead. An anomaly detector, trained on clean air only, flags readings that are unusual before they reach a threshold.", points: ["Forecast line drawn against the warning and trip thresholds", "\"Predicted crossing in N s\" when the forecast reaches a limit", "The last ten anomalies with time and peak"] },
      { h: "A model card, not a black box", p: "Every model shows its version, its training date, its error against a no-change baseline, the exposures it caught, its median warning lead time and its false alarms per hour. If it does not beat the simple baseline, the forecast line stays off." },
    ],
    limits: {
      can: ["Warn earlier than a fixed threshold when the data supports it", "Show its own accuracy honestly", "Retrain on your site's data"],
      cannot: ["Actuate anything: predictions are advisory", "Replace the edge controller's interlocks", "Measure gases the sensor cannot detect"],
    },
  },
  {
    slug: "prevention",
    name: "Prevention",
    title: "Stop leaks at the source, in milliseconds",
    lead: "The edge controller on site owns safety. It runs staged alarms, a latched trip, the siren, SCRAM, extraction and scrubbing locally, whether or not the cloud is reachable.",
    shot: { src: "/images/product/alarms.png", alt: "Alarms page with a three-tier escalation strip, active alarm list and incident log" },
    sections: [
      { h: "Staged alarms with hysteresis", p: "Normal, pre-hazard and critical tiers with separate on and off thresholds, so relays and lamps never chatter near a limit. A three-minute warm-up suppresses trips while sensors heat up." },
      { h: "A latched trip and a physical reset", p: "A critical reading latches the trip, the red strobe and the siren. The first press of the acknowledge button silences the siren; only a press once readings are normal resets the trip. Nothing in the cloud can clear it." },
      { h: "SCRAM and two-person overrides", p: "Any operator can SCRAM in one confirmed click. Anything that reduces safety, such as a relay override or a threshold change, needs a second, different supervisor and their PIN, enforced on the server and recorded in the audit trail." },
      { h: "Alarm management that follows ISA-18.2", p: "Priorities, acknowledge and shelve with a reason and an expiry, standing and chattering alarm counts, and an incident log with peak readings." },
    ],
  },
  {
    slug: "capture",
    name: "Capture",
    title: "Capture CO2 and prove how much",
    lead: "Extracted gas passes through a packed column with a liquid caustic solvent that absorbs CO2. ClathraRefine tracks removal efficiency, the mass balance, solvent loading and the captured mass, hour by hour.",
    shot: { src: "/images/product/measurements.png", alt: "Measurements page with the CO2 mass balance formula, inlet and outlet analysers and removal efficiency" },
    sections: [
      { h: "Mass balance you can check", p: "The capture rate is shown as the formula with the live numbers substituted in: pressure, flow, temperature and the inlet and outlet concentrations." },
      { h: "Solvent loading before it saturates", p: "Each litre of 0.025 M sodium hydroxide holds about 0.55 g of CO2 as carbonate. The loading gauge shows how much of that capacity is used so the solvent is changed on time." },
      { h: "Reporting by department and quota", p: "Daily and weekly summaries, departmental emissions against quota and the surplus available to sell, exported as CSV and PDF." },
    ],
  },
  {
    slug: "marketplace",
    name: "Marketplace",
    title: "Turn captured carbon into revenue",
    lead: "Sell captured CO2 and recovered by-products to other companies on the same platform. Every listing shows where and when it was captured and the sensor data behind the lot.",
    shot: { src: "/images/product/marketplace.png", alt: "Marketplace with product cards for liquid CO2, biomethane, carbon tokens and sodium carbonate solution" },
    sections: [
      { h: "Listings start from a capture lot", p: "Sellers create a listing from a lot on the Capture pages, so the site, the dates and the source tag travel with the product." },
      { h: "Provenance buyers can inspect", p: "Each lot carries a chart of the tag data that produced it. Carbon tokens carry a hash-chained ledger where every entry covers the previous one and the telemetry batch behind the credit." },
      { h: "Quotes, invoices and payment", p: "Buyers request quotes, download proforma invoices priced from the database, and pay through Paystack with the seller's share split automatically. An order is paid only after a verified payment notification." },
    ],
  },
];

export type Industry = { slug: string; name: string; hazards: string[]; fit: string; lead: string };

export const INDUSTRIES: Industry[] = [
  { slug: "mini-refineries", name: "Mini-refineries", lead: "Modular refineries run hot equipment beside volatile products in tight spaces.", hazards: ["Hydrocarbon vapour leaks at pumps, flanges and loading points", "Flue gas from furnaces and heaters", "Flaring when units upset"], fit: "Edge controllers trip locally on vapour build-up, the scrubber captures CO2 from the furnace flue, and captured CO2 is sold through the marketplace." },
  { slug: "gas-processing", name: "Gas processing", lead: "Sweetening and compression plants handle sour gas and high pressures around the clock.", hazards: ["Combustible gas releases at compressors and valves", "Sour gas handling", "Vented and flared gas"], fit: "Prediction gives operators a head start on rising readings, two-person overrides protect the interlocks, and capture reporting tracks what the scrubber removes." },
  { slug: "lpg-depots", name: "LPG depots", lead: "Bottling and storage sites move heavy, ground-hugging gas every shift.", hazards: ["LPG leaks that pool at low points", "Leaks during filling and transfer", "Ignition sources near loading bays"], fit: "Ambient sensors at low points feed staged alarms and the siren; extraction starts on its own and the incident log records every excursion." },
  { slug: "chemical-plants", name: "Chemical plants", lead: "Process plants combine solvents, reactors and utilities under strict permits.", hazards: ["Flammable vapour from solvents", "Process upsets", "Emissions reporting obligations"], fit: "Alarm management, audit workspace and statutory archive sit beside the live safety view, so compliance evidence comes from the same data." },
  { slug: "boiler-houses", name: "Industrial boiler houses", lead: "Steam boilers burn fuel continuously and produce most of a site's CO2.", hazards: ["Fuel gas leaks at burners", "Flue gas CO2 and NOx", "Unattended operation overnight"], fit: "Local trips work without the network, flue gas is scrubbed and measured, and the captured mass counts towards the departmental quota." },
];
