"use node";

import Parallel from "parallel-web";
import OpenAI from "openai";
import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { matchConditionClaims, normalizeConfidence, toClaims } from "../lib/parallel/basis";
import { classifyScreen, CLASSIFICATION_ORDER } from "../lib/parallel/classify";
import {
  PRICING,
  STAGE_CONFIG,
  findallActualCost,
  taskActualCost,
  type FindAllGenerator,
} from "../lib/parallel/cost";
import { rankCandidates } from "../lib/parallel/prioritize";
import {
  DILIGENCE_LABELS,
  DILIGENCE_OUTPUT_SCHEMA,
  FOLLOWUP_OUTPUT_SCHEMA,
  SCREEN_INPUT_SCHEMA,
  SCREEN_LABELS,
  SCREEN_OUTPUT_SCHEMA,
  diligenceInput,
} from "../lib/parallel/specs";
import type { Claim, RawFieldBasis } from "../lib/parallel/types";

const POLL_MS = 8000;

function parallelClient(): Parallel {
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) throw new Error("PARALLEL_API_KEY is not set in the Convex deployment");
  return new Parallel({ apiKey });
}

function responsesClient(): OpenAI {
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) throw new Error("PARALLEL_API_KEY is not set in the Convex deployment");
  return new OpenAI({ apiKey, baseURL: "https://api.parallel.ai/v1" });
}

const matchConditionArg = v.object({ name: v.string(), description: v.string() });

/* ------------------------------------------------------------------ */
/* Thesis -> FindAll schema (free, synchronous)                        */
/* ------------------------------------------------------------------ */

export const ingestThesis = action({
  args: { objective: v.string() },
  returns: v.object({
    objective: v.string(),
    entityType: v.string(),
    matchConditions: v.array(matchConditionArg),
    generator: v.string(),
  }),
  handler: async (_ctx, args): Promise<{ objective: string; entityType: string; matchConditions: Array<{ name: string; description: string }>; generator: string }> => {
    const client = parallelClient();
    const schema = await client.beta.findall.ingest({ objective: args.objective });
    return {
      objective: schema.objective,
      entityType: schema.entity_type,
      matchConditions: schema.match_conditions.map((m) => ({ name: m.name, description: m.description })),
      generator: schema.generator ?? STAGE_CONFIG.discover.generator,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Stage 1: Discover (FindAll)                                          */
/* ------------------------------------------------------------------ */

export const startDiscover = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run) return null;
    try {
      const client = parallelClient();
      await ctx.runMutation(internal.runs.setStatus, { runId, status: "discovering" });
      await ctx.runMutation(internal.runs.updateStage, {
        runId,
        stage: "discover",
        stats: { startedAt: Date.now(), count: 0, spendUsd: 0 },
      });
      await log(ctx, runId, "discover", "info", `Starting discovery (${run.generator}) with ${run.matchConditions.length} match conditions, limit ${run.matchLimit}.`);

      const created = await client.beta.findall.create({
        objective: run.objective,
        entity_type: run.entityType,
        match_conditions: run.matchConditions,
        generator: run.generator as FindAllGenerator,
        match_limit: run.matchLimit,
        metadata: { runId },
      });
      await ctx.runMutation(internal.runs.patch, { runId, findallId: created.findall_id });
      await log(ctx, runId, "discover", "progress", `Discovery run ${created.findall_id} queued.`);
      await ctx.scheduler.runAfter(POLL_MS, internal.pipeline.pollDiscover, { runId });
    } catch (err) {
      await fail(ctx, runId, "discover", err);
    }
    return null;
  },
});

export const pollDiscover = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run || !run.findallId || run.status !== "discovering") return null;
    try {
      const client = parallelClient();
      const result = await client.beta.findall.result(run.findallId);
      const status = result.run.status;
      const generated = status.metrics.generated_candidates_count ?? 0;
      const matched = status.metrics.matched_candidates_count ?? 0;

      const candidates = result.candidates.map((c) => ({
        candidate: {
          candidateId: c.candidate_id,
          name: c.name,
          url: c.url,
          description: c.description ?? null,
          matchStatus: c.match_status,
          matchOutput: c.output ?? null,
        },
        claims:
          c.match_status === "matched"
            ? matchConditionClaims(c.output, c.basis as RawFieldBasis[] | null, conditionLabels(run))
            : [],
      }));

      const { newlyMatched, inserted }: { newlyMatched: number; inserted: number } = await ctx.runMutation(internal.companies.upsertCandidates, {
        runId,
        candidates,
      });

      if (generated !== run.generatedCount || matched !== run.matchedCount) {
        await ctx.runMutation(internal.runs.patch, { runId, generatedCount: generated, matchedCount: matched });
      }
      if (newlyMatched > 0 || inserted > 0) {
        await log(ctx, runId, "discover", "progress", `${generated} candidates evaluated, ${matched} matched.`);
      }
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "discover", stats: { count: matched } });

      if (status.is_active) {
        await ctx.scheduler.runAfter(POLL_MS, internal.pipeline.pollDiscover, { runId });
        return null;
      }

      const reason = status.termination_reason ?? status.status;
      const spend = findallActualCost(run.generator as FindAllGenerator, matched);
      await ctx.runMutation(internal.runs.patch, { runId, terminationReason: reason });
      await ctx.runMutation(internal.runs.updateStage, {
        runId,
        stage: "discover",
        stats: { completedAt: Date.now(), count: matched, spendUsd: spend, note: reason },
      });
      await ctx.runMutation(internal.budget.addSpend, { usd: spend });
      await log(ctx, runId, "discover", "info", `Discovery finished (${reason}). ${matched} matched of ${generated} evaluated. Spend $${spend.toFixed(2)}.`);

      if (matched === 0) {
        await ctx.runMutation(internal.runs.setStatus, { runId, status: "failed", error: "Discovery found no matches. Try a broader thesis." });
        return null;
      }
      await ctx.scheduler.runAfter(0, internal.pipeline.prioritize, { runId });
    } catch (err) {
      await fail(ctx, runId, "discover", err);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Stage 2: Prioritize (no API calls)                                  */
/* ------------------------------------------------------------------ */

export const prioritize = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run) return null;
    try {
      await ctx.runMutation(internal.runs.setStatus, { runId, status: "prioritizing" });
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "prioritize", stats: { startedAt: Date.now(), spendUsd: 0 } });
      const companies: Doc<"companies">[] = await ctx.runQuery(internal.companies.forRunInternal, { runId });
      const discoverClaims: Doc<"claims">[] = await ctx.runQuery(internal.companies.claimsForRunStage, { runId, stage: "discover" });
      const basisByCompany = new Map<string, RawFieldBasis[]>();
      for (const k of discoverClaims) {
        const list = basisByCompany.get(k.companyId) ?? [];
        list.push({ field: k.field, reasoning: k.reasoning, confidence: k.confidence, citations: k.citations });
        basisByCompany.set(k.companyId, list);
      }
      const ranked = rankCandidates(
        companies.map((c) => ({
          _id: c._id,
          candidate_id: c.candidateId,
          name: c.name,
          url: c.url,
          description: c.description ?? null,
          match_status: c.matchStatus,
          output: (c.matchOutput as Record<string, unknown> | null) ?? null,
          basis: basisByCompany.get(c._id) ?? null,
        })),
        run.screenLimit,
      );
      await ctx.runMutation(internal.companies.setPriority, {
        entries: ranked.map((r) => ({
          companyId: r.candidate._id as Id<"companies">,
          score: r.priority.score,
          rank: r.rank,
          reasons: r.priority.reasons,
        })),
      });
      await ctx.runMutation(internal.runs.updateStage, {
        runId,
        stage: "prioritize",
        stats: { completedAt: Date.now(), count: ranked.length, spendUsd: 0 },
      });
      await log(ctx, runId, "prioritize", "info", `Prioritized ${ranked.length} of ${companies.filter((c) => c.matchStatus === "matched").length} matched companies for screening using discovery evidence only.`);
      await ctx.scheduler.runAfter(0, internal.pipeline.startScreen, { runId });
    } catch (err) {
      await fail(ctx, runId, "prioritize", err);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Stage 3: Screen (Task Group, core)                                  */
/* ------------------------------------------------------------------ */

export const startScreen = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run) return null;
    try {
      const client = parallelClient();
      const processor = STAGE_CONFIG.screen.processor;
      const companies: Doc<"companies">[] = (await ctx.runQuery(internal.companies.forRunInternal, { runId }) as Doc<"companies">[])
        .filter((c) => c.stage === "prioritized")
        .sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));

      await ctx.runMutation(internal.runs.setStatus, { runId, status: "screening" });
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "screen", stats: { startedAt: Date.now(), count: 0, spendUsd: 0 } });
      await log(ctx, runId, "screen", "info", `Screening ${companies.length} companies on the ${processor} processor via a Task Group.`);

      const group = await client.taskGroup.create({ metadata: { runId } });
      await ctx.runMutation(internal.runs.patch, { runId, screenTaskGroupId: group.taskgroup_id });

      const added = await client.taskGroup.addRuns(group.taskgroup_id, {
        default_task_spec: {
          input_schema: { type: "json", json_schema: SCREEN_INPUT_SCHEMA },
          output_schema: { type: "json", json_schema: SCREEN_OUTPUT_SCHEMA },
        },
        inputs: companies.map((c) => ({
          input: {
            company_name: c.name,
            company_url: c.url,
            company_description: c.description ?? "",
            thesis: run.thesis,
          },
          processor,
          metadata: { companyId: c._id },
        })),
      });

      const now = Date.now();
      for (let i = 0; i < companies.length; i++) {
        await ctx.runMutation(internal.companies.setTaskState, {
          companyId: companies[i]._id,
          kind: "screen",
          state: { taskRunId: added.run_ids[i], status: "queued", processor, startedAt: now },
        });
      }
      await log(ctx, runId, "screen", "progress", `${added.run_ids.length} task runs queued in group ${group.taskgroup_id}.`);
      await ctx.scheduler.runAfter(POLL_MS, internal.pipeline.pollScreen, { runId });
    } catch (err) {
      await fail(ctx, runId, "screen", err);
    }
    return null;
  },
});

export const pollScreen = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run || run.status !== "screening") return null;
    try {
      const client = parallelClient();
      const companies: Doc<"companies">[] = (await ctx.runQuery(internal.companies.forRunInternal, { runId }) as Doc<"companies">[]).filter(
        (c) => c.screen?.taskRunId,
      );
      const pending = companies.filter((c) => c.screen!.status === "queued" || c.screen!.status === "running");

      let completedNow = 0;
      for (const c of pending) {
        const state = c.screen!;
        const tr = await client.taskRun.retrieve(state.taskRunId!);
        if (tr.status === "completed") {
          const result = await client.taskRun.result(tr.run_id, { timeout: 30 });
          const content = result.output.type === "json" ? result.output.content : { summary: result.output.content };
          const claims = toClaims("screen", content as Record<string, unknown>, result.output.basis as RawFieldBasis[], SCREEN_LABELS);
          const verdict = classifyScreen(claims);
          await ctx.runMutation(internal.companies.completeTask, {
            companyId: c._id,
            kind: "screen",
            state: { ...state, status: "completed", completedAt: Date.now(), output: content },
            claims: stripClaims(claims),
            classification: verdict.classification,
            reasons: verdict.reasons,
            strength: verdict.strength,
          });
          completedNow += 1;
          await log(ctx, runId, "screen", "progress", `${c.name}: ${labelFor(verdict.classification)}. ${verdict.reasons[0] ?? ""}`);
        } else if (tr.status === "failed" || tr.status === "cancelled") {
          await ctx.runMutation(internal.companies.setTaskState, {
            companyId: c._id,
            kind: "screen",
            state: { ...state, status: "failed", completedAt: Date.now(), error: tr.error?.message ?? tr.status },
          });
          await log(ctx, runId, "screen", "warn", `${c.name}: screen ${tr.status}.`);
        } else if (tr.status === "running" && state.status !== "running") {
          await ctx.runMutation(internal.companies.setTaskState, {
            companyId: c._id,
            kind: "screen",
            state: { ...state, status: "running" },
          });
        }
      }

      const refreshed: Doc<"companies">[] = (await ctx.runQuery(internal.companies.forRunInternal, { runId }) as Doc<"companies">[]).filter((c) => c.screen?.taskRunId);
      const done = refreshed.filter((c) => c.screen!.status === "completed").length;
      const stillActive = refreshed.some((c) => c.screen!.status === "queued" || c.screen!.status === "running");
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "screen", stats: { count: done } });

      if (stillActive) {
        await ctx.scheduler.runAfter(POLL_MS, internal.pipeline.pollScreen, { runId });
        return null;
      }

      const spend = taskActualCost(STAGE_CONFIG.screen.processor, done);
      await ctx.runMutation(internal.runs.updateStage, {
        runId,
        stage: "screen",
        stats: { completedAt: Date.now(), count: done, spendUsd: spend },
      });
      await ctx.runMutation(internal.budget.addSpend, { usd: spend });

      const counts = { high_priority: 0, investigate: 0, pass: 0 };
      for (const c of refreshed) if (c.screenClassification) counts[c.screenClassification] += 1;
      await log(ctx, runId, "screen", "info", `Screening finished: ${counts.high_priority} high priority, ${counts.investigate} investigate, ${counts.pass} pass. Spend $${spend.toFixed(2)}.`);

      const picks = refreshed
        .filter((c) => c.screenClassification && c.screenClassification !== "pass")
        .sort(
          (a, b) =>
            CLASSIFICATION_ORDER[a.screenClassification!] - CLASSIFICATION_ORDER[b.screenClassification!] ||
            (b.screenStrength ?? 0) - (a.screenStrength ?? 0) ||
            (a.priorityRank ?? 99) - (b.priorityRank ?? 99),
        )
        .slice(0, run.diligenceLimit);

      if (picks.length === 0) {
        await ctx.runMutation(internal.runs.updateStage, { runId, stage: "diligence", stats: { startedAt: Date.now(), completedAt: Date.now(), count: 0, spendUsd: 0, note: "no candidates" } });
        await ctx.runMutation(internal.runs.setStatus, { runId, status: "complete" });
        await log(ctx, runId, "diligence", "warn", "No company cleared the screen. Nothing sent to diligence.");
        return null;
      }
      await ctx.scheduler.runAfter(0, internal.pipeline.startDiligence, { runId, companyIds: picks.map((c) => c._id) });
      void completedNow;
    } catch (err) {
      await fail(ctx, runId, "screen", err);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Stage 4: Diligence (Task, pro)                                      */
/* ------------------------------------------------------------------ */

export const startDiligence = internalAction({
  args: { runId: v.id("runs"), companyIds: v.array(v.id("companies")) },
  returns: v.null(),
  handler: async (ctx, { runId, companyIds }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run) return null;
    try {
      const client = parallelClient();
      const processor = STAGE_CONFIG.diligence.processor;
      await ctx.runMutation(internal.runs.setStatus, { runId, status: "diligencing" });
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "diligence", stats: { startedAt: Date.now(), count: 0, spendUsd: 0 } });
      await log(ctx, runId, "diligence", "info", `Running ${processor} diligence on ${companyIds.length} finalists.`);

      // Create every finalist's task concurrently. Parallel runs them in
      // parallel; we only poll for completion.
      const finalists = (
        await Promise.all(companyIds.map((companyId) => ctx.runQuery(internal.companies.getInternal, { companyId })))
      ).filter((c): c is Doc<"companies"> => c !== null);
      const created = await Promise.all(
        finalists.map((company) =>
          client.taskRun.create({
            input: diligenceInput({ name: company.name, url: company.url, description: company.description, thesis: run.thesis }),
            processor,
            task_spec: { output_schema: { type: "json", json_schema: DILIGENCE_OUTPUT_SCHEMA } },
            metadata: { runId, companyId: company._id },
            enable_events: true,
          }),
        ),
      );
      const startedAt = Date.now();
      await Promise.all(
        finalists.map((company, i) =>
          ctx.runMutation(internal.companies.setTaskState, {
            companyId: company._id,
            kind: "diligence",
            state: { taskRunId: created[i].run_id, status: "queued", processor, startedAt },
            interactionId: created[i].interaction_id,
          }),
        ),
      );
      await log(ctx, runId, "diligence", "progress", `${created.length} diligence tasks started concurrently: ${finalists.map((c) => c.name).join(", ")}.`);
      await ctx.scheduler.runAfter(POLL_MS, internal.pipeline.pollDiligence, { runId });
    } catch (err) {
      await fail(ctx, runId, "diligence", err);
    }
    return null;
  },
});

export const pollDiligence = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const run: Doc<"runs"> | null = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run || run.status !== "diligencing") return null;
    try {
      const client = parallelClient();
      const companies: Doc<"companies">[] = (await ctx.runQuery(internal.companies.forRunInternal, { runId }) as Doc<"companies">[]).filter((c) => c.diligence?.taskRunId);
      const pending = companies.filter((c) => c.diligence!.status === "queued" || c.diligence!.status === "running");

      for (const c of pending) {
        const state = c.diligence!;
        const tr = await client.taskRun.retrieve(state.taskRunId!);
        if (tr.status === "completed") {
          const result = await client.taskRun.result(tr.run_id, { timeout: 30 });
          const content = result.output.type === "json" ? result.output.content : { report: result.output.content };
          const claims = toClaims("diligence", content as Record<string, unknown>, result.output.basis as RawFieldBasis[], DILIGENCE_LABELS);
          await ctx.runMutation(internal.companies.completeTask, {
            companyId: c._id,
            kind: "diligence",
            state: { ...state, status: "completed", completedAt: Date.now(), output: content },
            claims: stripClaims(claims),
            interactionId: tr.interaction_id,
          });
          const supported = claims.filter((k) => k.supported).length;
          await log(ctx, runId, "diligence", "progress", `${c.name}: diligence complete. ${supported}/${claims.length} fields supported by citations.`);
        } else if (tr.status === "failed" || tr.status === "cancelled") {
          await ctx.runMutation(internal.companies.setTaskState, {
            companyId: c._id,
            kind: "diligence",
            state: { ...state, status: "failed", completedAt: Date.now(), error: tr.error?.message ?? tr.status },
          });
          await log(ctx, runId, "diligence", "warn", `${c.name}: diligence ${tr.status}.`);
        } else if (tr.status === "running") {
          const { messages, lastEventAt } = await harvestProgress(client, tr.run_id, state.lastEventAt);
          for (const m of messages) await log(ctx, runId, "diligence", "progress", `${c.name}: ${m}`);
          if (state.status !== "running" || lastEventAt !== state.lastEventAt) {
            await ctx.runMutation(internal.companies.setTaskState, {
              companyId: c._id,
              kind: "diligence",
              state: { ...state, status: "running", lastEventAt: lastEventAt ?? state.lastEventAt },
            });
          }
          if (state.status !== "running" && messages.length === 0) {
            await log(ctx, runId, "diligence", "progress", `${c.name}: researching.`);
          }
        }
      }

      const refreshed: Doc<"companies">[] = (await ctx.runQuery(internal.companies.forRunInternal, { runId }) as Doc<"companies">[]).filter((c) => c.diligence?.taskRunId);
      const done = refreshed.filter((c) => c.diligence!.status === "completed").length;
      const stillActive = refreshed.some((c) => c.diligence!.status === "queued" || c.diligence!.status === "running");
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "diligence", stats: { count: done } });

      if (stillActive) {
        await ctx.scheduler.runAfter(POLL_MS, internal.pipeline.pollDiligence, { runId });
        return null;
      }

      const spend = taskActualCost(STAGE_CONFIG.diligence.processor, done);
      await ctx.runMutation(internal.runs.updateStage, { runId, stage: "diligence", stats: { completedAt: Date.now(), count: done, spendUsd: spend } });
      await ctx.runMutation(internal.budget.addSpend, { usd: spend });
      await ctx.runMutation(internal.runs.setStatus, { runId, status: "complete" });
      await log(ctx, runId, "diligence", "info", `Diligence finished for ${done} companies. Spend $${spend.toFixed(2)}. Run complete.`);
    } catch (err) {
      await fail(ctx, runId, "diligence", err);
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* On-demand: follow-up question (Responses API)                        */
/* ------------------------------------------------------------------ */

export const askFollowup = action({
  args: { companyId: v.id("companies"), question: v.string() },
  returns: v.id("followups"),
  handler: async (ctx, args): Promise<Id<"followups">> => {
    const company: Doc<"companies"> | null = await ctx.runQuery(internal.companies.getInternal, { companyId: args.companyId });
    if (!company) throw new Error("Company not found");
    const question = args.question.trim().slice(0, 500);
    if (!question) throw new Error("Question is empty");

    const client = responsesClient();
    const started = Date.now();
    const effort = "low" as const;
    const response = await client.responses.create({
      model: "parallel",
      input: `Company: ${company.name} (${company.url}).\nQuestion from an investor doing early diligence: ${question}\nAnswer only from credible web sources. If the evidence is missing or conflicting, say so.`,
      reasoning: { effort },
      text: {
        format: {
          type: "json_schema",
          name: "followup_answer",
          schema: FOLLOWUP_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
        },
      },
    });

    let parsed: { answer: string; confidence: string; evidence_status: "supported" | "partial" | "unknown" };
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      parsed = { answer: response.output_text, confidence: "low", evidence_status: "partial" };
    }

    const citations: Array<{ url: string; title: string | null; excerpts: string[] }> = [];
    for (const item of response.output) {
      if (item.type !== "message") continue;
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations ?? []) {
          if (a.type === "url_citation" && !citations.some((c) => c.url === a.url)) {
            citations.push({ url: a.url, title: a.title ?? null, excerpts: [] });
          }
        }
      }
    }

    const id: Id<"followups"> = await ctx.runMutation(internal.companies.addFollowup, {
      runId: company.runId,
      companyId: company._id,
      question,
      answer: parsed.answer,
      confidence: normalizeConfidence(parsed.confidence),
      evidenceStatus: parsed.evidence_status,
      citations,
      effort,
      latencyMs: Date.now() - started,
      costUsd: PRICING.responses[effort],
    });
    await ctx.runMutation(internal.budget.addSpend, { usd: PRICING.responses[effort] });
    return id;
  },
});

/* ------------------------------------------------------------------ */
/* On-demand: verify a citation (Extract API)                           */
/* ------------------------------------------------------------------ */

export const verifyCitation = action({
  args: { companyId: v.id("companies"), url: v.string(), claimText: v.string() },
  returns: v.id("verifications"),
  handler: async (ctx, args): Promise<Id<"verifications">> => {
    const client = parallelClient();
    let status: "confirmed" | "not_found" | "error" = "error";
    let excerpts: string[] = [];
    let title: string | null = null;
    try {
      const res = await client.extract({
        urls: [args.url],
        objective: `Find the passage supporting this claim: ${args.claimText.slice(0, 400)}`,
      });
      const first = res.results[0];
      if (first) {
        excerpts = first.excerpts.slice(0, 3);
        title = first.title ?? null;
        status = excerpts.length > 0 ? "confirmed" : "not_found";
      } else if (res.errors.length > 0) {
        status = "error";
      } else {
        status = "not_found";
      }
    } catch {
      status = "error";
    }
    await ctx.runMutation(internal.budget.addSpend, { usd: PRICING.extractPerUrl });
    return await ctx.runMutation(internal.companies.addVerification, {
      companyId: args.companyId,
      url: args.url,
      claimText: args.claimText,
      status,
      excerpts,
      title,
    });
  },
});

/* ------------------------------------------------------------------ */
/* On-demand: watch a company (Monitor API, flag-gated)                 */
/* ------------------------------------------------------------------ */

export const watchCompany = action({
  args: { companyId: v.id("companies") },
  returns: v.object({ enabled: v.boolean(), monitorId: v.union(v.string(), v.null()), message: v.string() }),
  handler: async (ctx, args): Promise<{ enabled: boolean; monitorId: string | null; message: string }> => {
    const company: Doc<"companies"> | null = await ctx.runQuery(internal.companies.getInternal, { companyId: args.companyId });
    if (!company) throw new Error("Company not found");
    await ctx.runMutation(internal.companies.setMonitor, { companyId: company._id, monitorId: company.monitorId, requestedAt: Date.now() });

    if (process.env.ENABLE_MONITORS !== "true") {
      return {
        enabled: false,
        monitorId: null,
        message:
          "Monitoring is disabled in the public demo to avoid ongoing API costs. The integration is implemented and can be enabled in production.",
      };
    }
    const taskRunId = company.screen?.taskRunId;
    if (!taskRunId) {
      return { enabled: true, monitorId: null, message: "This company has no completed screen to snapshot yet." };
    }
    if (company.monitorId) {
      return { enabled: true, monitorId: company.monitorId, message: "Already watching." };
    }
    const client = parallelClient();
    const monitor = await client.monitor.create({
      type: "snapshot",
      frequency: "1w",
      processor: "lite",
      settings: { task_run_id: taskRunId },
      metadata: { companyId: company._id, runId: company.runId },
    });
    await ctx.runMutation(internal.companies.setMonitor, { companyId: company._id, monitorId: monitor.monitor_id, requestedAt: Date.now() });
    return { enabled: true, monitorId: monitor.monitor_id, message: "Weekly snapshot monitor created on the screening task." };
  },
});

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */


async function log(
  ctx: ActionCtx,
  runId: Id<"runs">,
  stage: string,
  level: "info" | "progress" | "warn" | "error",
  message: string,
) {
  await ctx.runMutation(internal.events.log, { runId, stage, level, message });
}

async function fail(ctx: ActionCtx, runId: Id<"runs">, stage: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${stage}] run ${runId} failed:`, err);
  await log(ctx, runId, stage, "error", message);
  await ctx.runMutation(internal.runs.setStatus, { runId, status: "failed", error: message });
}

function conditionLabels(run: Doc<"runs">): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const m of run.matchConditions) labels[m.name] = m.description;
  return labels;
}

function labelFor(c: "high_priority" | "investigate" | "pass"): string {
  return c === "high_priority" ? "High priority" : c === "investigate" ? "Investigate" : "Pass";
}


/**
 * Read a few seconds of a running task's event stream and return new
 * progress messages (plans, searches, tool calls) since the last cursor.
 * Parallel's stream starts from the beginning, so we filter by timestamp.
 */
async function harvestProgress(
  client: Parallel,
  runId: string,
  since: string | undefined,
): Promise<{ messages: string[]; lastEventAt: string | undefined }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const fresh: Array<{ at: string; text: string }> = [];
  let last = since;
  try {
    const stream = await client.taskRun.events(runId, { signal: controller.signal });
    for await (const ev of stream) {
      if (!("type" in ev) || typeof ev.type !== "string") continue;
      if (!ev.type.startsWith("task_run.progress_msg")) continue;
      const msg = ev as { message?: string; timestamp?: string };
      if (!msg.message || !msg.timestamp) continue;
      if (since && msg.timestamp <= since) continue;
      fresh.push({ at: msg.timestamp, text: msg.message });
      if (!last || msg.timestamp > last) last = msg.timestamp;
      if (fresh.length >= 12) break;
    }
  } catch {
    // Aborted after the time budget or stream closed; keep what we have.
  } finally {
    clearTimeout(timer);
  }
  const messages = fresh
    .filter((f) => !/^Objective:/.test(f.text))
    .slice(-3)
    .map((f) => f.text.replace(/^Query:\s*/, "searching: ").slice(0, 160));
  return { messages, lastEventAt: last };
}

/** Drop nothing today, but keep one place to trim claim payloads if needed. */
function stripClaims(claims: Claim[]): Claim[] {
  return claims.map((c) => ({
    ...c,
    citations: c.citations.map((cit) => ({
      url: cit.url,
      title: cit.title ?? null,
      excerpts: cit.excerpts.slice(0, 4).map((e) => e.slice(0, 1200)),
    })),
    reasoning: c.reasoning.slice(0, 4000),
  }));
}
