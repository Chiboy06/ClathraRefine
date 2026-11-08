import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServer } from "./access";

// App records (commands, overrides, orders, audits, audit log, settings...) for lib/server/db.ts.
// Called only by the Next.js server, which checks the user's role first, so each call carries SERVER_KEY.

const recordOut = v.any();

export const get = query({
  args: { serverKey: v.string(), coll: v.string(), key: v.string() },
  returns: v.union(recordOut, v.null()),
  handler: async (ctx, { serverKey, coll, key }) => {
    requireServer(serverKey);
    const r = await ctx.db
      .query("records")
      .withIndex("by_coll_key", (q) => q.eq("coll", coll).eq("key", key))
      .unique();
    return r?.data ?? null;
  },
});

/** Newest first: keys are time-sortable ids. */
export const list = query({
  args: { serverKey: v.string(), coll: v.string(), limit: v.number() },
  returns: v.array(recordOut),
  handler: async (ctx, { serverKey, coll, limit }) => {
    requireServer(serverKey);
    const rows = await ctx.db
      .query("records")
      .withIndex("by_coll_key", (q) => q.eq("coll", coll))
      .order("desc")
      .take(Math.min(Math.max(limit, 1), 1000));
    return rows.map((r) => r.data);
  },
});

export const put = mutation({
  args: { serverKey: v.string(), coll: v.string(), key: v.string(), created_at: v.number(), data: v.any() },
  returns: v.null(),
  handler: async (ctx, { serverKey, coll, key, created_at, data }) => {
    requireServer(serverKey);
    const cur = await ctx.db
      .query("records")
      .withIndex("by_coll_key", (q) => q.eq("coll", coll).eq("key", key))
      .unique();
    if (cur) await ctx.db.replace(cur._id, { coll, key, created_at, data });
    else await ctx.db.insert("records", { coll, key, created_at, data });
    return null;
  },
});

const cond = v.object({ field: v.string(), eq: v.optional(v.any()), ne: v.optional(v.any()), gte: v.optional(v.number()), hasEq: v.boolean(), hasNe: v.boolean() });

/**
 * Conditional update in one transaction. Used for the two-person rule (status pending AND requested_by <> approver),
 * idempotent payments and audit locking. Returns false when a condition fails.
 */
export const update = mutation({
  args: { serverKey: v.string(), coll: v.string(), key: v.string(), patch: v.any(), conds: v.array(cond) },
  returns: v.boolean(),
  handler: async (ctx, { serverKey, coll, key, patch, conds }) => {
    requireServer(serverKey);
    const cur = await ctx.db
      .query("records")
      .withIndex("by_coll_key", (q) => q.eq("coll", coll).eq("key", key))
      .unique();
    if (!cur) return false;
    const d = cur.data as Record<string, unknown>;
    for (const c of conds) {
      const val = d[c.field];
      if (c.hasEq && val !== c.eq) return false;
      if (c.hasNe && val === c.ne) return false;
      if (c.gte !== undefined && !(typeof val === "number" && val >= c.gte)) return false;
    }
    await ctx.db.patch(cur._id, { data: { ...d, ...(patch as Record<string, unknown>) } });
    return true;
  },
});
