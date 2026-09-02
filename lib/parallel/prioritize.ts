import { normalizeConfidence } from "./basis";
import type { FindAllCandidateLike } from "./types";

const AGGREGATOR_HOSTS = [
  "linkedin.com",
  "crunchbase.com",
  "pitchbook.com",
  "wikipedia.org",
  "ycombinator.com",
  "github.com",
  "x.com",
  "twitter.com",
  "medium.com",
  "producthunt.com",
  "g2.com",
];

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.6, low: 0.3 } as const;

export interface PriorityResult {
  score: number;
  reasons: string[];
  conditionsMatched: number;
  conditionsTotal: number;
  highConfidence: number;
  citations: number;
  ownDomain: boolean;
}

/**
 * Cheap prioritization using only FindAll outputs. No API calls.
 * Signals: how many match conditions passed and how confidently, how much
 * evidence backs them, and whether the URL is the company's own domain.
 */
export function prioritizeCandidate(c: FindAllCandidateLike): PriorityResult {
  const output = c.output ?? {};
  const basisByField = new Map((c.basis ?? []).map((b) => [b.field, b]));

  let conditionsTotal = 0;
  let conditionsMatched = 0;
  let highConfidence = 0;
  let citations = 0;
  let score = 0;

  for (const [field, raw] of Object.entries(output)) {
    const entry = raw as { is_matched?: boolean; type?: string } | undefined;
    if (!entry || typeof entry !== "object") continue;
    if (entry.type && entry.type !== "match_condition") continue;
    if (entry.is_matched === undefined) continue;
    conditionsTotal += 1;
    const b = basisByField.get(field);
    const conf = normalizeConfidence(b?.confidence);
    const n = b?.citations?.length ?? 0;
    citations += n;
    if (entry.is_matched) {
      conditionsMatched += 1;
      score += conf ? CONFIDENCE_WEIGHT[conf] : 0.5;
      if (conf === "high") highConfidence += 1;
    }
  }

  const ownDomain = isOwnDomain(c.url);
  score += Math.min(citations, 6) * 0.1;
  if (ownDomain) score += 0.3;
  if (c.description && c.description.length > 40) score += 0.2;

  const reasons: string[] = [];
  if (conditionsTotal > 0) {
    reasons.push(`${conditionsMatched}/${conditionsTotal} thesis conditions matched`);
  }
  if (highConfidence > 0) {
    reasons.push(`${highConfidence} at high confidence`);
  }
  reasons.push(`${citations} citation${citations === 1 ? "" : "s"}`);
  if (!ownDomain) reasons.push("URL is a third-party profile");

  return {
    score: Math.round(score * 100) / 100,
    reasons,
    conditionsMatched,
    conditionsTotal,
    highConfidence,
    citations,
    ownDomain,
  };
}

export function isOwnDomain(url: string): boolean {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    return !AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Rank candidates and return the top N with their rank. */
export function rankCandidates<T extends FindAllCandidateLike>(
  candidates: T[],
  limit: number,
): Array<{ candidate: T; priority: PriorityResult; rank: number }> {
  return candidates
    .filter((c) => c.match_status === "matched")
    .map((candidate) => ({ candidate, priority: prioritizeCandidate(candidate) }))
    .sort((a, b) => b.priority.score - a.priority.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}
