import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const runStatus = v.union(
  v.literal("draft"),
  v.literal("discovering"),
  v.literal("prioritizing"),
  v.literal("screening"),
  v.literal("diligencing"),
  v.literal("complete"),
  v.literal("failed"),
);

export const stageStats = v.object({
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  count: v.optional(v.number()),
  spendUsd: v.optional(v.number()),
  note: v.optional(v.string()),
});

export const matchCondition = v.object({
  name: v.string(),
  description: v.string(),
});

export const confidence = v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null());

export const classification = v.union(
  v.literal("high_priority"),
  v.literal("investigate"),
  v.literal("pass"),
);

export const decision = v.union(v.literal("pass"), v.literal("watch"), v.literal("deep_diligence"));

export const claimStage = v.union(
  v.literal("discover"),
  v.literal("screen"),
  v.literal("diligence"),
  v.literal("followup"),
);

export const citation = v.object({
  url: v.string(),
  title: v.optional(v.union(v.string(), v.null())),
  excerpts: v.array(v.string()),
});

export const taskState = v.object({
  taskRunId: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("queued"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  processor: v.string(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  output: v.optional(v.any()),
  error: v.optional(v.string()),
  lastEventAt: v.optional(v.string()),
});

export default defineSchema({
  settings: defineTable({
    key: v.literal("budget"),
    allocatedUsd: v.number(),
    spentUsd: v.number(),
    contact: v.string(),
  }).index("by_key", ["key"]),

  runs: defineTable({
    thesis: v.string(),
    objective: v.string(),
    entityType: v.string(),
    matchConditions: v.array(matchCondition),
    generator: v.string(),
    matchLimit: v.number(),
    screenLimit: v.number(),
    diligenceLimit: v.number(),
    status: runStatus,
    estimatedCostUsd: v.number(),
    spendUsd: v.number(),
    stages: v.object({
      discover: stageStats,
      prioritize: stageStats,
      screen: stageStats,
      diligence: stageStats,
    }),
    findallId: v.optional(v.string()),
    screenTaskGroupId: v.optional(v.string()),
    terminationReason: v.optional(v.string()),
    error: v.optional(v.string()),
    isCanonical: v.optional(v.boolean()),
    generatedCount: v.optional(v.number()),
    matchedCount: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_canonical", ["isCanonical"]),

  companies: defineTable({
    runId: v.id("runs"),
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
    stage: v.union(
      v.literal("discovered"),
      v.literal("prioritized"),
      v.literal("screened"),
      v.literal("diligenced"),
    ),
    priorityScore: v.optional(v.number()),
    priorityRank: v.optional(v.number()),
    priorityReasons: v.optional(v.array(v.string())),
    screen: v.optional(taskState),
    screenClassification: v.optional(classification),
    screenReasons: v.optional(v.array(v.string())),
    screenStrength: v.optional(v.number()),
    diligence: v.optional(taskState),
    diligenceInteractionId: v.optional(v.string()),
    decision: v.optional(decision),
    monitorId: v.optional(v.string()),
    monitorRequestedAt: v.optional(v.number()),
  })
    .index("by_run", ["runId"])
    .index("by_run_candidate", ["runId", "candidateId"])
    .index("by_run_stage", ["runId", "stage"]),

  claims: defineTable({
    runId: v.id("runs"),
    companyId: v.id("companies"),
    stage: claimStage,
    field: v.string(),
    label: v.string(),
    value: v.any(),
    valueText: v.string(),
    isUnknown: v.boolean(),
    reasoning: v.string(),
    confidence,
    citations: v.array(citation),
    citationCount: v.number(),
    supported: v.boolean(),
    conflicting: v.boolean(),
    order: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_company_stage", ["companyId", "stage"])
    .index("by_run_stage", ["runId", "stage"]),

  events: defineTable({
    runId: v.id("runs"),
    stage: v.string(),
    level: v.union(v.literal("info"), v.literal("progress"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    at: v.number(),
  }).index("by_run", ["runId"]),

  followups: defineTable({
    runId: v.id("runs"),
    companyId: v.id("companies"),
    question: v.string(),
    answer: v.string(),
    confidence,
    evidenceStatus: v.union(v.literal("supported"), v.literal("partial"), v.literal("unknown")),
    citations: v.array(citation),
    effort: v.string(),
    latencyMs: v.number(),
    costUsd: v.number(),
  }).index("by_company", ["companyId"]),

  verifications: defineTable({
    companyId: v.id("companies"),
    url: v.string(),
    claimText: v.string(),
    status: v.union(v.literal("confirmed"), v.literal("not_found"), v.literal("error")),
    excerpts: v.array(v.string()),
    title: v.optional(v.union(v.string(), v.null())),
    at: v.number(),
  }).index("by_company", ["companyId"]),
});
