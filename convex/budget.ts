import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const DEFAULT_ALLOCATION_USD = 30;
export const DEFAULT_CONTACT = "yashvisal@gmail.com";

const budgetShape = v.object({
  allocatedUsd: v.number(),
  spentUsd: v.number(),
  remainingUsd: v.number(),
  contact: v.string(),
});

export const get = query({
  args: {},
  returns: budgetShape,
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "budget"))
      .unique();
    const allocatedUsd = row?.allocatedUsd ?? DEFAULT_ALLOCATION_USD;
    const spentUsd = row?.spentUsd ?? 0;
    return {
      allocatedUsd,
      spentUsd,
      remainingUsd: Math.max(0, Math.round((allocatedUsd - spentUsd) * 100) / 100),
      contact: row?.contact ?? DEFAULT_CONTACT,
    };
  },
});

/** Idempotent. Creates the budget row if missing. Used by seeding and admin. */
export const ensure = mutation({
  args: { allocatedUsd: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "budget"))
      .unique();
    if (!row) {
      await ctx.db.insert("settings", {
        key: "budget",
        allocatedUsd: args.allocatedUsd ?? DEFAULT_ALLOCATION_USD,
        spentUsd: 0,
        contact: DEFAULT_CONTACT,
      });
    } else if (args.allocatedUsd !== undefined) {
      await ctx.db.patch(row._id, { allocatedUsd: args.allocatedUsd });
    }
    return null;
  },
});

export const addSpend = internalMutation({
  args: { usd: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "budget"))
      .unique();
    if (!row) {
      await ctx.db.insert("settings", {
        key: "budget",
        allocatedUsd: DEFAULT_ALLOCATION_USD,
        spentUsd: args.usd,
        contact: DEFAULT_CONTACT,
      });
    } else {
      await ctx.db.patch(row._id, { spentUsd: Math.round((row.spentUsd + args.usd) * 100) / 100 });
    }
    return null;
  },
});
