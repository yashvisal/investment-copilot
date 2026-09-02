import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

export const log = internalMutation({
  args: {
    runId: v.id("runs"),
    stage: v.string(),
    level: v.union(v.literal("info"), v.literal("progress"), v.literal("warn"), v.literal("error")),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("events", { ...args, at: Date.now() });
    return null;
  },
});

export const forRun = query({
  args: { runId: v.id("runs") },
  returns: v.array(schema.doc("events")),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(200);
    return rows.reverse();
  },
});
