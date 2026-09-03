import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import schema, { matchCondition, runStatus, stageStats } from "./schema";
import { DEFAULT_ALLOCATION_USD, DEFAULT_CONTACT } from "./budget";
import { DEFAULT_DILIGENCE_LIMIT, DEFAULT_SCREEN_LIMIT, STAGE_CONFIG, estimateRun } from "../lib/parallel/cost";

const runDoc = schema.doc("runs");

export const list = query({
  args: {},
  returns: v.array(runDoc),
  handler: async (ctx) => {
    return await ctx.db.query("runs").order("desc").take(20);
  },
});

export const get = query({
  args: { runId: v.id("runs") },
  returns: v.union(runDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const getInternal = internalQuery({
  args: { runId: v.id("runs") },
  returns: v.union(runDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const canonical = query({
  args: {},
  returns: v.union(runDoc, v.null()),
  handler: async (ctx) => {
    const flagged = await ctx.db
      .query("runs")
      .withIndex("by_canonical", (q) => q.eq("isCanonical", true))
      .order("desc")
      .first();
    if (flagged) return flagged;
    return await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "complete"))
      .order("desc")
      .first();
  },
});

/**
 * Create a run and kick off discovery. Enforces the project budget: the
 * estimate must fit in what remains, otherwise the caller gets a structured
 * refusal to show the contact message.
 */
export const start = mutation({
  args: {
    thesis: v.string(),
    objective: v.string(),
    entityType: v.string(),
    matchConditions: v.array(matchCondition),
    matchLimit: v.number(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), runId: v.id("runs") }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("budget"), v.literal("disabled"), v.literal("busy")),
      message: v.string(),
      contact: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (![10, 15, 20, 25].includes(args.matchLimit)) {
      throw new Error("matchLimit must be 10, 15, 20, or 25");
    }
    if (args.matchConditions.length === 0) {
      throw new Error("At least one match condition is required");
    }

    const budgetRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "budget"))
      .unique();
    const allocated = budgetRow?.allocatedUsd ?? DEFAULT_ALLOCATION_USD;
    const spent = budgetRow?.spentUsd ?? 0;
    const contact = budgetRow?.contact ?? DEFAULT_CONTACT;

    const caps = {
      matchLimit: args.matchLimit,
      screenLimit: DEFAULT_SCREEN_LIMIT,
      diligenceLimit: DEFAULT_DILIGENCE_LIMIT,
    };
    const estimate = estimateRun(caps);

    if (spent + estimate.totalUsd > allocated) {
      return {
        ok: false as const,
        reason: "budget" as const,
        message: `This run is estimated at $${estimate.totalUsd.toFixed(2)} but only $${Math.max(0, allocated - spent).toFixed(2)} of the project's $${allocated.toFixed(0)} research budget remains.`,
        contact,
      };
    }

    const active = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "discovering"))
      .first();
    if (active) {
      return {
        ok: false as const,
        reason: "busy" as const,
        message: "Another run is discovering right now. Wait for it to finish before starting a new one.",
        contact,
      };
    }

    const runId = await ctx.db.insert("runs", {
      thesis: args.thesis,
      objective: args.objective,
      entityType: args.entityType,
      matchConditions: args.matchConditions,
      generator: STAGE_CONFIG.discover.generator,
      matchLimit: caps.matchLimit,
      screenLimit: caps.screenLimit,
      diligenceLimit: caps.diligenceLimit,
      status: "draft",
      estimatedCostUsd: estimate.totalUsd,
      spendUsd: 0,
      stages: { discover: {}, prioritize: {}, screen: {}, diligence: {} },
    });

    await ctx.scheduler.runAfter(0, internal.pipeline.startDiscover, { runId });
    return { ok: true as const, runId };
  },
});

export const setStatus = internalMutation({
  args: {
    runId: v.id("runs"),
    status: runStatus,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      ...(args.error !== undefined ? { error: args.error } : {}),
    });
    return null;
  },
});

/** Stop an active run. Polling loops exit on the next tick; the discovery job is cancelled upstream. */
export const cancel = mutation({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status === "complete" || run.status === "failed") return null;
    await ctx.db.patch(runId, { status: "failed", error: "Stopped by you." });
    await ctx.db.insert("events", { runId, stage: run.status, at: Date.now(), level: "info", message: "Run stopped by you." });
    if (run.status === "discovering" && run.findallId) {
      await ctx.scheduler.runAfter(0, internal.pipeline.cancelDiscover, { runId });
    }
    return null;
  },
});

export const patch = internalMutation({
  args: {
    runId: v.id("runs"),
    findallId: v.optional(v.string()),
    screenTaskGroupId: v.optional(v.string()),
    terminationReason: v.optional(v.string()),
    generatedCount: v.optional(v.number()),
    matchedCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, ...fields }) => {
    const clean = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(runId, clean);
    return null;
  },
});

export const updateStage = internalMutation({
  args: {
    runId: v.id("runs"),
    stage: v.union(
      v.literal("discover"),
      v.literal("prioritize"),
      v.literal("screen"),
      v.literal("diligence"),
    ),
    stats: stageStats,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    const prev = run.stages[args.stage];
    const next = { ...prev, ...args.stats };
    const stages = { ...run.stages, [args.stage]: next };
    const spendUsd = Math.round(
      Object.values(stages).reduce((n, s) => n + (s.spendUsd ?? 0), 0) * 100,
    ) / 100;
    await ctx.db.patch(args.runId, { stages, spendUsd });
    return null;
  },
});

export const markCanonical = mutation({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("runs")
      .withIndex("by_canonical", (q) => q.eq("isCanonical", true))
      .take(10);
    for (const r of existing) await ctx.db.patch(r._id, { isCanonical: false });
    await ctx.db.patch(args.runId, { isCanonical: true });
    return null;
  },
});
