import type { Claim, ClaimStage, Confidence, RawFieldBasis } from "./types";

const CONFLICT_PATTERN =
  /\b(conflict|conflicting|inconsistent|contradict|discrepan|differ(s|ing)? (between|across)|could not reconcile|unclear whether)\b/i;

const UNKNOWN_STRINGS = new Set([
  "",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "not available",
  "not found",
  "insufficient evidence",
  "unknown: insufficient credible evidence",
]);

export function normalizeConfidence(raw: string | null | undefined): Confidence | null {
  if (!raw) return null;
  const c = raw.toLowerCase().trim();
  if (c === "high" || c === "medium" || c === "low") return c;
  return null;
}

export function isUnknownValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return UNKNOWN_STRINGS.has(value.trim().toLowerCase());
  if (Array.isArray(value)) return value.length === 0 || value.every(isUnknownValue);
  if (typeof value === "object") {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.length === 0 || entries.every(isUnknownValue);
  }
  return false;
}

export function valueToText(value: unknown): string {
  if (isUnknownValue(value)) return "Unknown: insufficient credible evidence";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => valueToText(item)).join("; ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => !isUnknownValue(v))
      .map(([k, v]) => `${humanize(k)}: ${valueToText(v)}`)
      .join(", ");
  }
  return String(value);
}

export function humanize(field: string): string {
  return field
    .replace(/\.\d+$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Turn a Parallel output (content + basis) into Claims, one per top-level
 * field. Per-element basis entries (e.g. `funding_history.0`) are folded into
 * the parent claim's citations so the parent stays the unit of evidence.
 */
export function toClaims(
  stage: ClaimStage,
  content: Record<string, unknown>,
  basis: RawFieldBasis[] | null | undefined,
  labels: Record<string, string> = {},
): Claim[] {
  const byField = new Map<string, RawFieldBasis>();
  const elementCitations = new Map<string, RawFieldBasis["citations"]>();

  for (const entry of basis ?? []) {
    const dot = entry.field.indexOf(".");
    if (dot === -1) {
      byField.set(entry.field, entry);
    } else {
      const parent = entry.field.slice(0, dot);
      const existing = elementCitations.get(parent) ?? [];
      elementCitations.set(parent, [...existing, ...(entry.citations ?? [])]);
    }
  }

  const fields = new Set<string>([...Object.keys(content), ...byField.keys()]);
  const claims: Claim[] = [];

  for (const field of fields) {
    const value = field in content ? content[field] : null;
    const b = byField.get(field);
    const rawCitations = [...(b?.citations ?? []), ...(elementCitations.get(field) ?? [])];
    const citations = dedupeCitations(rawCitations);
    const unknown = isUnknownValue(value);
    const reasoning = b?.reasoning ?? "";
    claims.push({
      stage,
      field,
      label: labels[field] ?? humanize(field),
      value: value ?? null,
      valueText: valueToText(value),
      isUnknown: unknown,
      reasoning,
      confidence: normalizeConfidence(b?.confidence),
      citations,
      citationCount: citations.length,
      supported: !unknown && citations.length > 0,
      conflicting: CONFLICT_PATTERN.test(reasoning),
    });
  }

  return claims;
}

/** Claims for FindAll match conditions. The value is the extracted evidence. */
export function matchConditionClaims(
  output: Record<string, unknown> | null | undefined,
  basis: RawFieldBasis[] | null | undefined,
  labels: Record<string, string> = {},
): Claim[] {
  const content: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(output ?? {})) {
    const entry = raw as { value?: unknown; is_matched?: boolean; type?: string } | undefined;
    if (!entry || typeof entry !== "object") continue;
    const matched = entry.is_matched;
    const evidence = entry.value;
    content[key] =
      matched === undefined
        ? evidence
        : `${matched ? "Matched" : "Not matched"}${isUnknownValue(evidence) ? "" : `: ${valueToText(evidence)}`}`;
  }
  return toClaims("discover", content, basis, labels);
}

function dedupeCitations(
  raw: NonNullable<RawFieldBasis["citations"]>,
): Claim["citations"] {
  const seen = new Map<string, Claim["citations"][number]>();
  for (const c of raw) {
    if (!c?.url) continue;
    const existing = seen.get(c.url);
    const excerpts = (c.excerpts ?? []).filter(Boolean);
    if (existing) {
      for (const e of excerpts) if (!existing.excerpts.includes(e)) existing.excerpts.push(e);
    } else {
      seen.set(c.url, { url: c.url, title: c.title ?? null, excerpts: [...excerpts] });
    }
  }
  return [...seen.values()];
}

export function summarizeClaims(claims: Claim[]) {
  const total = claims.length;
  const supported = claims.filter((c) => c.supported).length;
  const unknown = claims.filter((c) => c.isUnknown).length;
  const unsupported = claims.filter((c) => !c.isUnknown && c.citationCount === 0).length;
  const conflicting = claims.filter((c) => c.conflicting).length;
  const citations = claims.reduce((n, c) => n + c.citationCount, 0);
  const high = claims.filter((c) => c.confidence === "high").length;
  const low = claims.filter((c) => c.confidence === "low").length;
  return { total, supported, unknown, unsupported, conflicting, citations, high, low };
}
