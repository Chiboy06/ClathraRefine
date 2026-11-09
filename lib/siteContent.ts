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
