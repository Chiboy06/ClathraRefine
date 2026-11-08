import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePerm } from "./access";

/** Latest readings, oldest first. Reactive: dashboards update without polling. */
export const recent = query({
  args: { device: v.string(), limit: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, { device, limit }) => {
    await requirePerm(ctx, "read");
    const rows = await ctx.db
      .query("telemetry")
      .withIndex("by_device_ingest", (q) => q.eq("device", device))
      .order("desc")
      .take(Math.min(Math.max(limit, 1), 900));
    return rows.reverse();
  },
});

export const latest = query({
  args: { device: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { device }) => {
    await requirePerm(ctx, "read");
    const doc = await ctx.db
      .query("latest")
      .withIndex("by_device", (q) => q.eq("device", device))
      .unique();
    return doc?.row ?? null;
  },
});

/** Board events and command acknowledgements, newest first. */
export const events = query({
  args: { device: v.string(), limit: v.number(), since: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { device, limit, since }) => {
    await requirePerm(ctx, "read");
    return await ctx.db
      .query("events")
      .withIndex("by_device_ingest", (q) => (since ? q.eq("device", device).gte("ingest_ms", since) : q.eq("device", device)))
      .order("desc")
      .take(Math.min(Math.max(limit, 1), 500));
  },
});

/** Hourly rollups for History. */
export const rollups = query({
  args: { device: v.string(), from: v.number(), to: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, { device, from, to }) => {
    await requirePerm(ctx, "read");
    return await ctx.db
      .query("rollups")
      .withIndex("by_device_hour", (q) => q.eq("device", device).gte("hour", from).lte("hour", to))
      .take(24 * 400);
  },
});
