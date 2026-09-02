import type { Claim, Classification } from "./types";

const LATE_STAGE_ROUNDS = /series\s*[c-h]|growth|pre-ipo|mezzanine|late[- ]stage/i;
const LATE_STAGE_TOTAL_USD_M = 150;

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

  // Hard passes.
  if (concern && !concern.isUnknown && concern.citationCount > 0) {
    reasons.push(`Thesis concern: ${truncate(concern.valueText, 120)}`);
    return { classification: "pass", reasons, strength: 0 };
  }
  const roundText = round && !round.isUnknown ? String(round.value) : "";
  if (LATE_STAGE_ROUNDS.test(roundText)) {
    reasons.push(`Late-stage round (${roundText})`);
    return { classification: "pass", reasons, strength: 0 };
  }
  const totalNum = total && typeof total.value === "number" ? total.value : null;
  if (totalNum !== null && totalNum > LATE_STAGE_TOTAL_USD_M) {
    reasons.push(`Total raised $${totalNum}M exceeds the $${LATE_STAGE_TOTAL_USD_M}M ceiling`);
    return { classification: "pass", reasons, strength: 0 };
  }
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
    reasons.push(`Enterprise traction at ${traction!.confidence} confidence, ${traction!.citationCount} sources`);
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

  if (tractionStrong && momentumStrong) {
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
