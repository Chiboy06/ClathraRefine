import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const BATCH = 500;
const SIGNALS = ["exhaust_mv", "ambient_mv", "co2_in_ppm", "co2_out_ppm", "reduction_pct", "capture_g_min", "gas_lpm", "liquid_lpm", "solvent_c", "ph"] as const;

/** Keep raw telemetry and events for 30 days. Deletes in batches and reschedules itself until done. */
export const purge = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * DAY;
    const old = await ctx.db
      .query("telemetry")
      .withIndex("by_ingest", (q) => q.lt("ingest_ms", cutoff))
      .take(BATCH);
    const oldEvents = await ctx.db
      .query("events")
      .withIndex("by_ingest", (q) => q.lt("ingest_ms", cutoff))
      .take(BATCH);
    const oldCache = await ctx.db
      .query("assistantCache")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - DAY))
      .take(BATCH);
    for (const r of [...old, ...oldEvents, ...oldCache]) await ctx.db.delete(r._id);
    if (old.length === BATCH || oldEvents.length === BATCH) await ctx.scheduler.runAfter(0, internal.maintenance.purge, {});
    return null;
  },
});

/** Hourly min/mean/max per signal for the previous hour, kept indefinitely. */
export const rollup = internalMutation({
  args: { hour: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const hour = args.hour ?? Math.floor((Date.now() - HOUR) / HOUR) * HOUR;
    const devices = await ctx.db.query("latest").take(100);
    for (const { device } of devices) {
      const rows = await ctx.db
        .query("telemetry")
        .withIndex("by_device_ingest", (q) => q.eq("device", device).gte("ingest_ms", hour).lt("ingest_ms", hour + HOUR))
        .take(4000);
      if (!rows.length) continue;
      const stats: Record<string, { min: number; mean: number; max: number }> = {};
      for (const s of SIGNALS) {
        const vals = rows.map((r) => r[s]).filter((x): x is number => typeof x === "number");
        if (vals.length) stats[s] = { min: Math.min(...vals), mean: vals.reduce((a, b) => a + b, 0) / vals.length, max: Math.max(...vals) };
      }
      const existing = await ctx.db
        .query("rollups")
        .withIndex("by_device_hour", (q) => q.eq("device", device).eq("hour", hour))
        .unique();
      if (existing) await ctx.db.replace(existing._id, { device, hour, n: rows.length, stats });
      else await ctx.db.insert("rollups", { device, hour, n: rows.length, stats });
    }
    return null;
  },
});
