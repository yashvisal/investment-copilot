/**
 * Shared types for the Investment Copilot pipeline.
 * Pure TypeScript: used by Convex functions, the UI, and scripts.
 */

export type Confidence = "high" | "medium" | "low";

export type Stage = "discover" | "prioritize" | "screen" | "diligence";

export type ClaimStage = "discover" | "screen" | "diligence" | "followup";

export type Classification = "high_priority" | "investigate" | "pass";

export type Decision = "pass" | "watch" | "deep_diligence";

export interface Citation {
  url: string;
  title?: string | null;
  excerpts: string[];
}

/**
 * A Claim is one researched field with its evidence. This is Parallel's
 * FieldBasis promoted to a first-class record so the product can reason about
 * support, conflict, and unknowns without digging through nested output.
 */
export interface Claim {
  stage: ClaimStage;
  field: string;
  label: string;
  value: unknown;
  valueText: string;
  isUnknown: boolean;
  reasoning: string;
  confidence: Confidence | null;
  citations: Citation[];
  citationCount: number;
  /** Non-null value backed by at least one citation. */
  supported: boolean;
  /** Reasoning mentions conflicting or inconsistent sources. */
  conflicting: boolean;
}

/** Raw FieldBasis as returned by Parallel. Kept loose on purpose. */
export interface RawFieldBasis {
  field: string;
  reasoning: string;
  confidence?: string | null;
  citations?: Array<{ url: string; title?: string | null; excerpts?: string[] | null }>;
}

export interface MatchCondition {
  name: string;
  description: string;
}

export interface FindAllCandidateLike {
  candidate_id: string;
  name: string;
  url: string;
  description?: string | null;
  match_status: "generated" | "matched" | "unmatched" | "discarded";
  output?: Record<string, unknown> | null;
  basis?: RawFieldBasis[] | null;
}
