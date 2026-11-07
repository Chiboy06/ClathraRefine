export type Currency = "NGN" | "USD";
export type ConcUnit = "PCT" | "PPM";

export const DEFAULT_RATE = 1450; // ₦ per $1, admin setting

/** Money is kept in kobo. USD shown at the current rate. */
export function koboToCurrency(kobo: number, currency: Currency, rate = DEFAULT_RATE): number {
  const naira = kobo / 100;
  return currency === "NGN" ? naira : naira / rate;
}

export function formatMoney(kobo: number, currency: Currency, rate = DEFAULT_RATE): string {
  const v = koboToCurrency(kobo, currency, rate);
  return currency === "NGN"
    ? `₦${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`
    : `$${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatConc(pctVol: number, unit: ConcUnit): string {
  return unit === "PCT"
    ? `${pctVol.toLocaleString("en-GB", { maximumFractionDigits: 2 })}% Vol`
    : `${Math.round(pctVol * 10_000).toLocaleString("en-GB")} PPM`;
}

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** Times are stored as UTC epoch ms and shown in en-GB with the zone visible. */
export const formatTime = (ms: number) => timeFmt.format(ms);
export const formatDateTime = (ms: number) => dateTimeFmt.format(ms);

export const num = (v: number, dp = 0) => v.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
