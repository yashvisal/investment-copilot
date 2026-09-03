import type { Doc } from "@/convex/_generated/dataModel";
import { CLASSIFICATION_ORDER } from "./parallel/classify";

export type Bucket = "finalists" | "cleared" | "passed" | "unscreened";

export const BUCKET_LABEL: Record<Bucket, string> = {
  finalists: "Finalists",
  cleared: "Cleared the screen",
  passed: "Passed at the screen",
  unscreened: "Matched, not screened",
};

export function bucketOf(c: Doc<"companies">): Bucket {
  if (c.diligence && c.diligence.status !== "failed") return "finalists";
  if (c.screen?.status === "completed") return c.screenClassification === "pass" ? "passed" : "cleared";
  return "unscreened";
}

const BUCKET_ORDER: Record<Bucket, number> = { finalists: 0, cleared: 1, passed: 2, unscreened: 3 };

/** Stable ordering used on the run page and for prev/next on company pages. */
export function orderCompanies(companies: Doc<"companies">[]): Doc<"companies">[] {
  return [...companies]
    .filter((c) => c.matchStatus === "matched")
    .sort((a, b) => {
      const ba = BUCKET_ORDER[bucketOf(a)];
      const bb = BUCKET_ORDER[bucketOf(b)];
      if (ba !== bb) return ba - bb;
      const ca = a.screenClassification ? CLASSIFICATION_ORDER[a.screenClassification] : 3;
      const cb = b.screenClassification ? CLASSIFICATION_ORDER[b.screenClassification] : 3;
      if (ca !== cb) return ca - cb;
      if ((b.screenStrength ?? 0) !== (a.screenStrength ?? 0)) return (b.screenStrength ?? 0) - (a.screenStrength ?? 0);
      return (a.priorityRank ?? 99) - (b.priorityRank ?? 99);
    });
}

/**
 * First n sentences, always starting from the beginning of the text. A period only
 * ends a sentence when whitespace or the end follows it, so "Kore.ai" stays intact.
 */
export function firstSentences(text: string, n: number): string {
  const ends = /[.!?]+(?=\s|$)/g;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = ends.exec(text))) {
    count++;
    if (count === n) return text.slice(0, m.index + m[0].length).trim();
  }
  return text.trim();
}

/** Drops a leading "Yes —", "No,", or similar verdict so prose reads as a statement, not a reply. */
export function stripVerdictLead(text: string): string {
  return text.replace(/^\s*(yes|no|absolutely|definitely|likely|probably)\b[\s,:;.!—–-]*/i, (m, w) => (m.length < text.length ? "" : w)).replace(/^\p{Ll}/u, (ch) => ch.toUpperCase());
}
