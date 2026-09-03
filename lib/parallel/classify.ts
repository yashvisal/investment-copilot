import type { Claim, Classification } from "./types";

/**
 * Only things that make a company un-investable regardless of thesis, plus an
 * explicit sector miss. Stage, size, and public listing are never disqualifiers
 * here; the thesis decides what stage it wants.
 */
const HARD_DISQUALIFIER =
  /\b(disqualified:|acquired|acquisition by|shut ?down|ceased operations|business unit|subsidiary|division of|outside the (sector|category|thesis)|does not (fit|match|operate in) the (sector|category|thesis)|not (an? )?(\w+ )?(company|startup) in the (sector|category))/i;

export interface ClassificationResult {
  classification: Classification;
  reasons: string[];
  /** Higher is stronger. Used to order diligence picks within a class. */
  strength: number;
}

/**
 * Deterministic screening policy. Reads screen claims (facts + basis) and
 * returns a class with human-readable reasons. The model never votes.
 */
export function classifyScreen(claims: Claim[]): ClassificationResult {
  const by = new Map(claims.map((c) => [c.field, c]));
  const reasons: string[] = [];
  let strength = 0;

  const concern = by.get("thesis_concern");
  const round = by.get("latest_funding_round");
  const total = by.get("total_raised_usd_millions");
  const traction = by.get("enterprise_traction");
  const momentum = by.get("recent_momentum");
  const sells = by.get("what_it_sells");

  // Hard passes. A concern only disqualifies when it names a real disqualifier;
  // soft concerns (stale momentum, thin data) downgrade instead of passing.
  let softConcern = false;
  if (concern && !concern.isUnknown) {
    if (HARD_DISQUALIFIER.test(concern.valueText) && concern.citationCount > 0) {
      reasons.push(`Thesis concern: ${truncate(concern.valueText, 120)}`);
      return { classification: "pass", reasons, strength: 0 };
    }
    softConcern = true;
  }
  const roundText = round && !round.isUnknown ? String(round.value) : "";
  const totalNum = total && typeof total.value === "number" ? total.value : null;
  if (sells && sells.isUnknown) {
    reasons.push("Could not establish what the company sells");
    return { classification: "pass", reasons, strength: 0 };
  }

  // Positive signals.
  const tractionStrong =
    !!traction && traction.supported && (traction.confidence === "high" || traction.confidence === "medium");
  const tractionWeak = !!traction && !traction.isUnknown && !tractionStrong;
  const momentumStrong =
    !!momentum && momentum.supported && (momentum.confidence === "high" || momentum.confidence === "medium");
  const momentumWeak = !!momentum && !momentum.isUnknown && !momentumStrong;

  if (tractionStrong) {
    strength += 2;
    reasons.push(`Enterprise traction at ${traction!.confidence} confidence, ${traction!.citationCount} source${traction!.citationCount === 1 ? "" : "s"}`);
  } else if (tractionWeak) {
    strength += 1;
    reasons.push("Enterprise traction claimed but thinly sourced");
  } else {
    reasons.push("No credible evidence of enterprise adoption");
  }

  if (momentumStrong) {
    strength += 1.5;
    reasons.push(`Recent momentum at ${momentum!.confidence} confidence`);
  } else if (momentumWeak) {
    strength += 0.5;
    reasons.push("Some momentum, weakly sourced");
  } else {
    reasons.push("No recent momentum found");
  }

  if (roundText) {
    strength += 0.5;
    reasons.push(`Stage: ${roundText}${totalNum !== null ? `, $${totalNum}M raised` : ""}`);
  } else {
    reasons.push("Funding stage undisclosed");
  }

  const conflicts = claims.filter((c) => c.conflicting).length;
  if (conflicts > 0) {
    strength -= 0.5;
    reasons.push(`${conflicts} field${conflicts === 1 ? "" : "s"} with conflicting sources`);
  }

  const unknowns = claims.filter((c) => c.isUnknown).length;
  if (unknowns >= 5) {
    strength -= 0.5;
    reasons.push(`${unknowns} of ${claims.length} fields unknown`);
  }

  if (softConcern) {
    strength -= 1;
    reasons.push(`Concern noted, not disqualifying: ${truncate(concern!.valueText, 100)}`);
  }

  if (tractionStrong && momentumStrong && !softConcern) {
    return { classification: "high_priority", reasons, strength };
  }
  if (tractionStrong || momentumStrong || tractionWeak) {
    return { classification: "investigate", reasons, strength };
  }
  return { classification: "pass", reasons, strength };
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export const CLASSIFICATION_ORDER: Record<Classification, number> = {
  high_priority: 0,
  investigate: 1,
  pass: 2,
};
