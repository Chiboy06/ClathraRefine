import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const TTL_MS = 2 * 60_000;

export const get = internalQuery({
  args: { hash: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { hash }) => {
    const r = await ctx.db
      .query("assistantCache")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .first();
    return r && Date.now() - r.at < TTL_MS ? r.answer : null;
  },
});

export const set = internalMutation({
  args: { hash: v.string(), answer: v.string() },
  returns: v.null(),
  handler: async (ctx, { hash, answer }) => {
    await ctx.db.insert("assistantCache", { hash, answer, at: Date.now() });
    return null;
  },
});
