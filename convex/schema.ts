import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const level = v.union(v.literal("NORMAL"), v.literal("WARNING"), v.literal("CRITICAL"));
const scrubber = v.union(v.literal("IDLE"), v.literal("INTAKE_ACTIVE"), v.literal("SCRUBBING"), v.literal("PURGING"));
const quality = v.union(v.literal("Good"), v.literal("Uncertain"), v.literal("Bad"), v.literal("Stale"));

/** One board reading as posted by the IoT rule, plus values derived at ingest. */
export const telemetryFields = {
  device: v.string(),
  ingest_ms: v.number(),
  ts: v.number(),
  uptime_ms: v.number(),
  exhaust_mv: v.number(),
  ambient_mv: v.number(),
  ambient_level: level,
  scrubber,
  relay_mask: v.number(),
  trip_latched: v.boolean(),
  siren_silenced: v.boolean(),
  warming_up: v.boolean(),
  scram: v.boolean(),
  sensor_fault: v.boolean(),
  buffered: v.boolean(),
  fw: v.string(),
  mode: v.optional(v.union(v.literal("AUTO"), v.literal("MANUAL"))),
  co2_in_mv: v.optional(v.number()),
  co2_out_mv: v.optional(v.number()),
  gas_lpm: v.optional(v.number()),
  liquid_lpm: v.optional(v.number()),
  solvent_c: v.optional(v.number()),
  ph: v.optional(v.number()),
  // derived at ingest
  co2_in_ppm: v.optional(v.number()),
  co2_out_ppm: v.optional(v.number()),
  reduction_pct: v.optional(v.number()),
  capture_g_min: v.optional(v.number()),
  quality,
};

export default defineSchema({
  telemetry: defineTable(telemetryFields).index("by_device_ingest", ["device", "ingest_ms"]).index("by_ingest", ["ingest_ms"]),
  latest: defineTable({ device: v.string(), row: v.object(telemetryFields) }).index("by_device", ["device"]),
  events: defineTable({
    device: v.string(),
    ingest_ms: v.number(),
    kind: v.union(v.literal("event"), v.literal("ack")),
    ambient_level: v.optional(level),
    scrubber: v.optional(scrubber),
    trip_latched: v.optional(v.boolean()),
    scram: v.optional(v.boolean()),
    mode: v.optional(v.union(v.literal("AUTO"), v.literal("MANUAL"))),
    cmd: v.optional(v.string()),
    accepted: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  })
    .index("by_device_ingest", ["device", "ingest_ms"])
    .index("by_ingest", ["ingest_ms"]),
  /** Hourly min/mean/max per signal, kept indefinitely for History. */
  rollups: defineTable({
    device: v.string(),
    hour: v.number(),
    n: v.number(),
    stats: v.record(v.string(), v.object({ min: v.number(), mean: v.number(), max: v.number() })),
  }).index("by_device_hour", ["device", "hour"]),
  /** App records (commands, orders, products, audits, audit log, settings, sensor calibration...), written by the Next.js server. */
  records: defineTable({ coll: v.string(), key: v.string(), created_at: v.number(), data: v.any() }).index("by_coll_key", ["coll", "key"]),
  /** Assistant answer cache so the free tier is not spent twice on the same question. */
  assistantCache: defineTable({ hash: v.string(), answer: v.string(), at: v.number() }).index("by_hash", ["hash"]).index("by_at", ["at"]),
  /** Users synced from Clerk via webhook. Keyed by Clerk userId. */
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),
});
