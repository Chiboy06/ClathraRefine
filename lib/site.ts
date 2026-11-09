export type SiteDetails = { plant: string; location: string; device: string; firmware: string; sensors: string; solventL: number; solventM: number; commissioned: string };

/** Shown until Settings > Site details saves real values. */
export const SITE_DEFAULTS: SiteDetails = {
  plant: "ClathraRefine capture skid",
  location: "Port Harcourt, Rivers State",
  device: "ESP32S3-N16R8-HARNESS-01",
  firmware: "rev-C",
  sensors: "2 × MQ-2 gas, 2 × MQ-135 CO2",
  solventL: 2,
  solventM: 0.025,
  commissioned: "6 Nov 2026",
};
