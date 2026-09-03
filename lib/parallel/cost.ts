/**
 * Cost and latency model. Prices from https://docs.parallel.ai/getting-started/pricing
 * (verified 2026-09-02). All USD.
 */

export const PRICING = {
  findall: {
    preview: { fixed: 0.1, perMatch: 0 },
    base: { fixed: 0.25, perMatch: 0.03 },
    core: { fixed: 2.0, perMatch: 0.15 },
    pro: { fixed: 10.0, perMatch: 1.0 },
  },
  task: {
    lite: 0.005,
    base: 0.01,
    core: 0.025,
    core2x: 0.05,
    pro: 0.1,
    ultra: 0.3,
  },
  responses: { low: 0.01, medium: 0.05, high: 0.25 },
  search: { turbo: 0.001, fast: 0.001, basic: 0.005, advanced: 0.005 },
  extractPerUrl: 0.001,
  monitorPerExecution: { lite: 0.003, base: 0.01 },
} as const;

export type FindAllGenerator = keyof typeof PRICING.findall;
export type TaskProcessor = keyof typeof PRICING.task;

/** Processor choices per stage. The whole point: spend rises with conviction. */
export const STAGE_CONFIG = {
  discover: { generator: "core" as FindAllGenerator, expectedMinutes: [3, 8] as const },
  screen: { processor: "core" as TaskProcessor, expectedMinutes: [1, 4] as const },
  diligence: { processor: "pro" as TaskProcessor, expectedMinutes: [5, 15] as const },
} as const;

export const MATCH_LIMIT_OPTIONS = [10, 15, 20] as const;
export type MatchLimit = (typeof MATCH_LIMIT_OPTIONS)[number];

export const DEFAULT_SCREEN_LIMIT = 10;
export const DEFAULT_DILIGENCE_LIMIT = 4;

export interface RunCaps {
  matchLimit: number;
  screenLimit: number;
  diligenceLimit: number;
}

export interface StageEstimate {
  stage: "discover" | "screen" | "diligence";
  primitive: string;
  processor: string;
  units: number;
  unitLabel: string;
  costUsd: number;
  expectedMinutes: readonly [number, number];
}

export function estimateRun(caps: RunCaps): { stages: StageEstimate[]; totalUsd: number } {
  const g = PRICING.findall[STAGE_CONFIG.discover.generator];
  const screenN = Math.min(caps.screenLimit, caps.matchLimit);
  const diligenceN = Math.min(caps.diligenceLimit, screenN);
  const stages: StageEstimate[] = [
    {
      stage: "discover",
      primitive: "FindAll",
      processor: STAGE_CONFIG.discover.generator,
      units: caps.matchLimit,
      unitLabel: "matches",
      costUsd: g.fixed + g.perMatch * caps.matchLimit,
      expectedMinutes: STAGE_CONFIG.discover.expectedMinutes,
    },
    {
      stage: "screen",
      primitive: "Task Group",
      processor: STAGE_CONFIG.screen.processor,
      units: screenN,
      unitLabel: "runs",
      costUsd: PRICING.task[STAGE_CONFIG.screen.processor] * screenN,
      expectedMinutes: STAGE_CONFIG.screen.expectedMinutes,
    },
    {
      stage: "diligence",
      primitive: "Task",
      processor: STAGE_CONFIG.diligence.processor,
      units: diligenceN,
      unitLabel: "runs",
      costUsd: PRICING.task[STAGE_CONFIG.diligence.processor] * diligenceN,
      expectedMinutes: STAGE_CONFIG.diligence.expectedMinutes,
    },
  ];
  const totalUsd = stages.reduce((n, s) => n + s.costUsd, 0);
  return { stages, totalUsd: round2(totalUsd) };
}

export function findallActualCost(generator: FindAllGenerator, matches: number): number {
  const g = PRICING.findall[generator];
  return round2(g.fixed + g.perMatch * matches);
}

export function taskActualCost(processor: TaskProcessor, completedRuns: number): number {
  return round2(PRICING.task[processor] * completedRuns);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatUsd(n: number): string {
  return n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`;
}
