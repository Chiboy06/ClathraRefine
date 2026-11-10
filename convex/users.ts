import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requirePerm } from "./access";

/** Upsert a user record synced from Clerk via webhook. Internal: called only from the HTTP action. */
export const upsert = internalMutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        role: args.role,
        updatedAt: args.updatedAt,
      });
    } else {
      await ctx.db.insert("users", args);
    }
    return null;
  },
});

/** Look up the current user's own record. Used by queries that need the role without a JWT claim. */
export const me = query({
  args: {},
  returns: v.union(
    v.object({ clerkId: v.string(), name: v.string(), email: v.optional(v.string()), role: v.string(), createdAt: v.number(), updatedAt: v.number() }),
    v.null(),
  ),
  handler: async (ctx) => {
    await requirePerm(ctx, "read");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    return user ? { clerkId: user.clerkId, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt } : null;
  },
});
