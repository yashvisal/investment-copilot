import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import schema, { classification, claimStage, decision, taskState } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import type { Claim } from "../lib/parallel/types";

const companyDoc = schema.doc("companies");
const claimDoc = schema.doc("claims");

export const forRun = query({
  args: { runId: v.id("runs") },
  returns: v.array(companyDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .take(500);
  },
});

export const forRunInternal = internalQuery({
  args: { runId: v.id("runs") },
  returns: v.array(companyDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .take(500);
  },
});

export const get = query({
  args: { companyId: v.id("companies") },
  returns: v.union(companyDoc, v.null()),
  handler: async (ctx, args) => ctx.db.get(args.companyId),
});

export const getInternal = internalQuery({
  args: { companyId: v.id("companies") },
  returns: v.union(companyDoc, v.null()),
  handler: async (ctx, args) => ctx.db.get(args.companyId),
});

export const claimsForRunStage = internalQuery({
  args: { runId: v.id("runs"), stage: claimStage },
  returns: v.array(claimDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("claims")
      .withIndex("by_run_stage", (q) => q.eq("runId", args.runId).eq("stage", args.stage))
      .take(2000);
  },
});

export const claimsFor = query({
  args: { companyId: v.id("companies"), stage: v.optional(claimStage) },
  returns: v.array(claimDoc),
  handler: async (ctx, args) => {
    const rows = args.stage
      ? await ctx.db
          .query("claims")
          .withIndex("by_company_stage", (q) => q.eq("companyId", args.companyId).eq("stage", args.stage!))
          .take(200)
      : await ctx.db
          .query("claims")
          .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
          .take(400);
    return rows.sort((a, b) => a.order - b.order);
  },
});

export const followupsFor = query({
  args: { companyId: v.id("companies") },
  returns: v.array(schema.doc("followups")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("followups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(50);
  },
});

export const verificationsFor = query({
  args: { companyId: v.id("companies") },
  returns: v.array(schema.doc("verifications")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verifications")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(50);
  },
});

const candidateInput = v.object({
  candidateId: v.string(),
  name: v.string(),
  url: v.string(),
  description: v.optional(v.union(v.string(), v.null())),
  matchStatus: v.union(
    v.literal("generated"),
    v.literal("matched"),
    v.literal("unmatched"),
    v.literal("discarded"),
  ),
  matchOutput: v.optional(v.any()),
});

const claimInput = v.object({
  stage: claimStage,
  field: v.string(),
  label: v.string(),
  value: v.any(),
  valueText: v.string(),
  isUnknown: v.boolean(),
  reasoning: v.string(),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null()),
  citations: v.array(
    v.object({
      url: v.string(),
      title: v.optional(v.union(v.string(), v.null())),
      excerpts: v.array(v.string()),
    }),
  ),
  citationCount: v.number(),
  supported: v.boolean(),
  conflicting: v.boolean(),
});

/**
 * Upsert FindAll candidates for a run. Returns how many are newly matched so
 * the caller can log progress. Claims for match conditions are replaced.
 */
export const upsertCandidates = internalMutation({
  args: {
    runId: v.id("runs"),
    candidates: v.array(
      v.object({
        candidate: candidateInput,
        claims: v.array(claimInput),
      }),
    ),
  },
  returns: v.object({ inserted: v.number(), newlyMatched: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    let newlyMatched = 0;
    for (const { candidate, claims } of args.candidates) {
      const existing = await ctx.db
        .query("companies")
        .withIndex("by_run_candidate", (q) =>
          q.eq("runId", args.runId).eq("candidateId", candidate.candidateId),
        )
        .unique();
      let companyId: Id<"companies">;
      if (!existing) {
        companyId = await ctx.db.insert("companies", {
          runId: args.runId,
          candidateId: candidate.candidateId,
          name: candidate.name,
          url: candidate.url,
          description: candidate.description ?? null,
          matchStatus: candidate.matchStatus,
          matchOutput: candidate.matchOutput ?? null,
          stage: "discovered",
        });
        inserted += 1;
        if (candidate.matchStatus === "matched") newlyMatched += 1;
      } else {
        companyId = existing._id;
        if (existing.matchStatus !== candidate.matchStatus || claims.length > 0) {
          if (existing.matchStatus !== "matched" && candidate.matchStatus === "matched") newlyMatched += 1;
          await ctx.db.patch(companyId, {
            matchStatus: candidate.matchStatus,
            matchOutput: candidate.matchOutput ?? existing.matchOutput ?? null,
            description: candidate.description ?? existing.description ?? null,
          });
        } else {
          continue;
        }
      }
      if (claims.length > 0) {
        await replaceClaims(ctx, args.runId, companyId, "discover", claims);
      }
    }
    return { inserted, newlyMatched };
  },
});

export const setPriority = internalMutation({
  args: {
    entries: v.array(
      v.object({
        companyId: v.id("companies"),
        score: v.number(),
        rank: v.number(),
        reasons: v.array(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const e of args.entries) {
      await ctx.db.patch(e.companyId, {
        priorityScore: e.score,
        priorityRank: e.rank,
        priorityReasons: e.reasons,
        stage: "prioritized",
      });
    }
    return null;
  },
});

export const setTaskState = internalMutation({
  args: {
    companyId: v.id("companies"),
    kind: v.union(v.literal("screen"), v.literal("diligence")),
    state: taskState,
    interactionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"companies">> =
      args.kind === "screen" ? { screen: args.state } : { diligence: args.state };
    if (args.interactionId) patch.diligenceInteractionId = args.interactionId;
    await ctx.db.patch(args.companyId, patch);
    return null;
  },
});

/** Record a completed task: output, claims, and (for screens) the class. */
export const completeTask = internalMutation({
  args: {
    companyId: v.id("companies"),
    kind: v.union(v.literal("screen"), v.literal("diligence")),
    state: taskState,
    claims: v.array(claimInput),
    classification: v.optional(classification),
    reasons: v.optional(v.array(v.string())),
    strength: v.optional(v.number()),
    interactionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company) return null;
    const patch: Partial<Doc<"companies">> = {};
    if (args.kind === "screen") {
      patch.screen = args.state;
      patch.stage = "screened";
      if (args.classification) patch.screenClassification = args.classification;
      if (args.reasons) patch.screenReasons = args.reasons;
      if (args.strength !== undefined) patch.screenStrength = args.strength;
    } else {
      patch.diligence = args.state;
      patch.stage = "diligenced";
      if (args.interactionId) patch.diligenceInteractionId = args.interactionId;
    }
    await ctx.db.patch(args.companyId, patch);
    await replaceClaims(ctx, company.runId, args.companyId, args.kind, args.claims);
    return null;
  },
});

export const setDecision = mutation({
  args: { companyId: v.id("companies"), decision: v.union(decision, v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.companyId, { decision: args.decision ?? undefined });
    return null;
  },
});

export const setMonitor = internalMutation({
  args: { companyId: v.id("companies"), monitorId: v.optional(v.string()), requestedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.companyId, {
      monitorId: args.monitorId,
      monitorRequestedAt: args.requestedAt,
    });
    return null;
  },
});

export const addFollowup = internalMutation({
  args: {
    runId: v.id("runs"),
    companyId: v.id("companies"),
    question: v.string(),
    answer: v.string(),
    confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null()),
    evidenceStatus: v.union(v.literal("supported"), v.literal("partial"), v.literal("unknown")),
    citations: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.union(v.string(), v.null())),
        excerpts: v.array(v.string()),
      }),
    ),
    effort: v.string(),
    latencyMs: v.number(),
    costUsd: v.number(),
  },
  returns: v.id("followups"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("followups", args);
  },
});

export const addVerification = internalMutation({
  args: {
    companyId: v.id("companies"),
    url: v.string(),
    claimText: v.string(),
    status: v.union(v.literal("confirmed"), v.literal("not_found"), v.literal("error")),
    excerpts: v.array(v.string()),
    title: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.id("verifications"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("verifications", { ...args, at: Date.now() });
  },
});

async function replaceClaims(
  ctx: { db: import("./_generated/server").DatabaseWriter },
  runId: Id<"runs">,
  companyId: Id<"companies">,
  stage: Claim["stage"],
  claims: Array<Omit<Claim, "stage"> & { stage: Claim["stage"] }>,
) {
  const old = await ctx.db
    .query("claims")
    .withIndex("by_company_stage", (q) => q.eq("companyId", companyId).eq("stage", stage))
    .take(400);
  for (const row of old) await ctx.db.delete(row._id);
  let order = 0;
  for (const c of claims) {
    await ctx.db.insert("claims", {
      runId,
      companyId,
      stage,
      field: c.field,
      label: c.label,
      value: c.value ?? null,
      valueText: c.valueText,
      isUnknown: c.isUnknown,
      reasoning: c.reasoning,
      confidence: c.confidence,
      citations: c.citations,
      citationCount: c.citationCount,
      supported: c.supported,
      conflicting: c.conflicting,
      order: order++,
    });
  }
}
