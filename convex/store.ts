import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { telemetryFields } from "./schema";
import type { Mq135Cal } from "../lib/mq135";

const calValidator = v.object({ rlKohm: v.number(), vcMv: v.number(), r0Kohm: v.number() });

/** Telemetry row plus the per-device latest document dashboards subscribe to. */
export const telemetry = internalMutation({
  args: { row: v.object(telemetryFields) },
  returns: v.null(),
  handler: async (ctx, { row }) => {
    await ctx.db.insert("telemetry", row);
    const cur = await ctx.db
      .query("latest")
      .withIndex("by_device", (q) => q.eq("device", row.device))
      .unique();
    if (cur) await ctx.db.replace(cur._id, { device: row.device, row });
    else await ctx.db.insert("latest", { device: row.device, row });
    return null;
  },
});

export const event = internalMutation({
  args: {
    device: v.string(),
    ingest_ms: v.number(),
    kind: v.union(v.literal("event"), v.literal("ack")),
    ambient_level: v.optional(v.union(v.literal("NORMAL"), v.literal("WARNING"), v.literal("CRITICAL"))),
    scrubber: v.optional(v.union(v.literal("IDLE"), v.literal("INTAKE_ACTIVE"), v.literal("SCRUBBING"), v.literal("PURGING"))),
    trip_latched: v.optional(v.boolean()),
    scram: v.optional(v.boolean()),
    mode: v.optional(v.union(v.literal("AUTO"), v.literal("MANUAL"))),
    cmd: v.optional(v.string()),
    accepted: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("events", args);
    return null;
  },
});

/** MQ-135 calibration for a device, stored by Settings > Sensors and calibration (records coll "sensors"). */
export const calibration = internalQuery({
  args: { device: v.string() },
  returns: v.object({ in: v.optional(calValidator), out: v.optional(calValidator) }),
  handler: async (ctx, { device }) => {
    const get = async (sensor: string): Promise<Mq135Cal | undefined> => {
      const r = await ctx.db
        .query("records")
        .withIndex("by_coll_key", (q) => q.eq("coll", "sensors").eq("key", `${device}:${sensor}`))
        .unique();
      const d = r?.data as { rlKohm?: number; vcMv?: number; r0Kohm?: number } | undefined;
      return d?.r0Kohm ? { rlKohm: d.rlKohm ?? 10, vcMv: d.vcMv ?? 5000, r0Kohm: d.r0Kohm } : undefined;
    };
    return { in: await get("co2_in"), out: await get("co2_out") };
  },
});
