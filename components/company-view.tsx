"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { hostname, millions, usd } from "@/lib/format";
import { summarizeClaims } from "@/lib/parallel/basis";
import { DILIGENCE_FACTS, DILIGENCE_SECTIONS } from "@/lib/parallel/specs";
import type { Decision } from "@/lib/parallel/types";
import { Nav } from "./nav";
import { Button, Card, ClassTag, ConfidenceTag, DECISION_LABEL, DecisionTag, Dot, Empty, Page, SectionLabel, Tag, cx } from "./ui";

type Claim = Doc<"claims">;
type TabKey = "thesis" | "diligence" | "evidence";

export function CompanyView({ runId, companyId }: { runId: Id<"runs">; companyId: Id<"companies"> }) {
  const run = useQuery(api.runs.get, { runId });
  const company = useQuery(api.companies.get, { companyId });
  const claims = useQuery(api.companies.claimsFor, { companyId });
  const [tab, setTabState] = useState<TabKey>("thesis");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "diligence" || h === "evidence") setTabState(h);
  }, []);
  const setTab = (t: TabKey) => {
    setTabState(t);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${t}`);
  };

  if (company === undefined || run === undefined) {
    return (
      <>
        <Nav />
        <Page>
          <p className="mt-12 text-small text-slate">Loading…</p>
        </Page>
      </>
    );
  }
  if (!company || !run) {
    return (
      <>
        <Nav />
        <Page>
          <Empty>Company not found.</Empty>
        </Page>
      </>
    );
  }

  const all = claims ?? [];
  const discover = all.filter((c) => c.stage === "discover");
  const screen = all.filter((c) => c.stage === "screen");
  const diligence = all.filter((c) => c.stage === "diligence");
  const summary = summarizeClaims([...screen, ...diligence]);

  return (
    <>
      <Nav />
      <Page>
        <div className="mt-8">
          <Link href={`/runs/${runId}`} className="chrome text-caption text-slate hover:text-ink-black">
            ← Back to run
          </Link>
        </div>

        <div className="mt-4 flex items-start justify-between gap-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-heading font-medium leading-[1.11] text-ink-black">{company.name}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a href={company.url} target="_blank" rel="noreferrer" className="chrome text-label text-schematic-blue hover:underline">
                {hostname(company.url)} ↗
              </a>
              <ClassTag classification={company.screenClassification} />
              {company.diligence?.status === "completed" && <Tag tone="ink">Diligenced</Tag>}
              {company.priorityRank !== undefined && <Tag tone="fog">Priority #{company.priorityRank}</Tag>}
              <DecisionTag decision={company.decision} />
            </div>
            {company.description && <p className="mt-4 max-w-[720px] font-serif text-base text-graphite">{company.description}</p>}
          </div>
          <DecisionPanel company={company} />
        </div>

        <EvidenceStrip summary={summary} />

        <div className="mt-10 flex gap-8 border-b border-hairline">
          {(
            [
              ["thesis", "Thesis"],
              ["diligence", "Diligence"],
              ["evidence", "Evidence"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cx(
                "chrome -mb-px border-b-2 pb-3 text-label transition-colors",
                tab === key ? "border-ink-black text-ink-black" : "border-transparent text-slate hover:text-ink-black",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "thesis" && <ThesisTab company={company} discover={discover} screen={screen} />}
          {tab === "diligence" && <DiligenceTab company={company} claims={diligence} />}
          {tab === "evidence" && <EvidenceTab company={company} claims={all} />}
        </div>
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */

function DecisionPanel({ company }: { company: Doc<"companies"> }) {
  const setDecision = useMutation(api.companies.setDecision);
  const watch = useAction(api.pipeline.watchCompany);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  async function onWatch() {
    setWatching(true);
    try {
      const res = await watch({ companyId: company._id });
      setWatchMsg(res.message);
      if (!company.decision) await setDecision({ companyId: company._id, decision: "watch" });
    } catch (e) {
      setWatchMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setWatching(false);
    }
  }

  return (
    <div className="w-[300px] shrink-0">
      <Card className="p-5">
        <SectionLabel>Your decision</SectionLabel>
        <p className="mt-2 text-small text-slate">Is this worth substantially more human research?</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["pass", "watch", "deep_diligence"] as Decision[]).map((d) => (
            <button
              key={d}
              onClick={() => setDecision({ companyId: company._id, decision: company.decision === d ? null : d })}
              className={cx(
                "chrome rounded-sm border px-2 py-2 text-caption transition-colors",
                company.decision === d ? "border-ink-black bg-ink-black text-cream-paper" : "border-hairline text-ink-black hover:bg-fog",
              )}
            >
              {DECISION_LABEL[d]}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-hairline pt-4">
          <Button variant="ghost" className="w-full" onClick={onWatch} disabled={watching}>
            {watching ? "Requesting…" : company.monitorId ? "Watching weekly" : "Watch company"}
          </Button>
          <p className="mt-2 text-caption text-slate">
            Creates a weekly Parallel snapshot monitor on the screening task and alerts on material change.
          </p>
          {watchMsg && <p className="mt-2 text-small text-graphite">{watchMsg}</p>}
        </div>
      </Card>
    </div>
  );
}

function EvidenceStrip({ summary }: { summary: ReturnType<typeof summarizeClaims> }) {
  if (summary.total === 0) return null;
  const items = [
    [summary.supported, "supported"],
    [summary.unsupported, "unsupported"],
    [summary.conflicting, "conflicting"],
    [summary.unknown, "unknown"],
    [summary.citations, "citations"],
  ] as const;
  return (
    <div className="mt-8 grid grid-cols-5 gap-6 border-t border-hairline">
      {items.map(([n, label]) => (
        <div key={label} className="pt-3">
          <div className="tnum font-serif text-heading-sm font-medium leading-none text-ink-black">{n}</div>
          <div className="chrome mt-1 text-caption text-slate">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ThesisTab({ company, discover, screen }: { company: Doc<"companies">; discover: Claim[]; screen: Claim[] }) {
  return (
    <div className="grid grid-cols-12 gap-10">
      <div className="col-span-12 lg:col-span-7">
        <SectionLabel>Screen</SectionLabel>
        {company.screen?.status === "completed" ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ClassTag classification={company.screenClassification} />
              <span className="chrome text-caption text-slate">
                {company.screen.processor} processor · {usd(0.025)}
              </span>
            </div>
            {company.screenReasons && (
              <ul className="mt-3 list-disc pl-5 text-body text-graphite">
                {company.screenReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <div className="mt-6 divide-y divide-hairline border-t border-hairline">
              {screen.map((c) => (
                <ClaimRow key={c._id} claim={c} />
              ))}
            </div>
          </>
        ) : company.screen ? (
          <p className="mt-3 flex items-center gap-2 text-small text-graphite">
            <Dot tone="orange" pulse /> Screening in progress on the {company.screen.processor} processor.
          </p>
        ) : (
          <p className="mt-3 text-small text-slate">
            Not screened. {company.priorityRank === undefined ? "This company matched but did not rank in the top set for screening." : "Waiting for screening to start."}
          </p>
        )}
      </div>
      <div className="col-span-12 lg:col-span-5">
        <SectionLabel>Discovery match</SectionLabel>
        {company.priorityReasons && (
          <p className="mt-2 text-small text-graphite">{company.priorityReasons.join(" · ")}</p>
        )}
        <div className="mt-3 divide-y divide-hairline border-t border-hairline">
          {discover.length === 0 && <p className="py-3 text-small text-slate">No match-condition evidence stored.</p>}
          {discover.map((c) => (
            <div key={c._id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="chrome text-caption text-graphite">{c.field.replace(/_/g, " ")}</div>
                <ConfidenceTag confidence={c.confidence} />
              </div>
              <p className="mt-1 text-small text-ink-black">{c.valueText}</p>
              {c.reasoning && <p className="mt-1 text-caption text-slate">{c.reasoning}</p>}
              <div className="chrome mt-1 text-caption text-slate">{c.citationCount} citation{c.citationCount === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DiligenceTab({ company, claims }: { company: Doc<"companies">; claims: Claim[] }) {
  const by = useMemo(() => new Map(claims.map((c) => [c.field, c])), [claims]);

  if (company.diligence?.status !== "completed") {
    return (
      <div className="max-w-[720px]">
        {company.diligence && (company.diligence.status === "queued" || company.diligence.status === "running") ? (
          <p className="flex items-center gap-2 text-body text-graphite">
            <Dot tone="orange" pulse /> Diligence is running on the {company.diligence.processor} processor. This takes several minutes.
          </p>
        ) : company.diligence?.status === "failed" ? (
          <p className="text-body text-status-red">Diligence failed: {company.diligence.error}</p>
        ) : (
          <>
            <p className="font-serif text-base text-ink-black">This company was not sent to diligence.</p>
            <p className="mt-2 text-body text-graphite">
              {company.screenClassification === "pass"
                ? "It was classified Pass at the screen, so no further compute was spent."
                : company.screenClassification
                  ? "It cleared the screen but did not rank among the finalists under the diligence cap."
                  : "It was not screened."}
            </p>
          </>
        )}
      </div>
    );
  }

  const facts = DILIGENCE_FACTS.map((f) => by.get(f)).filter(Boolean) as Claim[];

  return (
    <div>
      <div className="grid grid-cols-5 gap-6 border-t border-hairline">
        {facts.map((c) => (
          <div key={c._id} className="pt-3">
            <div className="chrome text-caption text-slate">{c.label}</div>
            <div className={cx("mt-1 font-serif text-base", c.isUnknown ? "italic text-slate" : "text-ink-black")}>
              {c.isUnknown ? "Unknown" : c.field.includes("usd") ? millions(c.value) : c.valueText}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-12 gap-10">
        <div className="col-span-12 space-y-10 lg:col-span-8">
          {DILIGENCE_SECTIONS.map((field) => {
            const c = by.get(field);
            if (!c) return null;
            return <Section key={field} claim={c} />;
          })}
        </div>
        <aside className="col-span-12 lg:col-span-4">
          <div className="sticky top-6">
            <SectionLabel>How to read this</SectionLabel>
            <p className="mt-2 text-small text-graphite">
              Every section is one researched field. Confidence and citation counts come from Parallel&apos;s research basis. Fields
              without credible evidence say so instead of guessing. Open the Evidence tab to inspect sources or verify a citation live.
            </p>
            <div className="chrome mt-4 text-caption text-slate">
              {company.diligence.processor} processor · {usd(0.1)} · task {company.diligence.taskRunId}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ claim }: { claim: Claim }) {
  const [showReasoning, setShowReasoning] = useState(false);
  return (
    <section className="border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="chrome text-body text-ink-black">{claim.label}</h2>
        <div className="flex items-center gap-2">
          {claim.conflicting && <Tag tone="amber">Conflicting sources</Tag>}
          <ConfidenceTag confidence={claim.confidence} />
          <Tag tone={claim.citationCount > 0 ? "neutral" : "red"}>
            {claim.citationCount} citation{claim.citationCount === 1 ? "" : "s"}
          </Tag>
        </div>
      </div>
      <div className="mt-3 max-w-[720px]">
        <ClaimValue claim={claim} />
      </div>
      {claim.reasoning && (
        <div className="mt-3">
          <button onClick={() => setShowReasoning((s) => !s)} className="chrome text-caption text-slate hover:text-ink-black">
            {showReasoning ? "Hide reasoning" : "Show reasoning"}
          </button>
          {showReasoning && <p className="mt-2 max-w-[720px] text-small text-graphite">{claim.reasoning}</p>}
        </div>
      )}
    </section>
  );
}

function ClaimValue({ claim }: { claim: Claim }) {
  if (claim.isUnknown) {
    return <p className="font-serif text-base italic text-slate">Unknown: insufficient credible evidence.</p>;
  }
  const v = claim.value;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return <p className="font-serif text-base leading-[1.6] text-ink-black">{String(v)}</p>;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string")) {
      return (
        <ul className="list-disc space-y-1 pl-5 font-serif text-base text-ink-black">
          {(v as string[]).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      );
    }
    const rows = v as Array<Record<string, unknown>>;
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return (
      <table className="w-full text-small">
        <thead>
          <tr className="chrome text-caption text-slate">
            {keys.map((k) => (
              <th key={k} className="pb-2 pr-4 text-left font-medium">
                {k.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline border-t border-hairline">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {keys.map((k) => (
                <td key={k} className={cx("py-2 pr-4", typeof r[k] === "number" && "tnum")}>
                  {r[k] === null || r[k] === undefined ? <span className="text-slate">—</span> : String(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <p className="font-serif text-base text-ink-black">{claim.valueText}</p>;
}

/* Compact claim row for the screen list. */
function ClaimRow({ claim }: { claim: Claim }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 py-3">
      <div>
        <div className="chrome text-caption text-graphite">{claim.label}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <ConfidenceTag confidence={claim.confidence} />
        </div>
        <div className="chrome mt-1 text-caption text-slate">{claim.citationCount} cit.</div>
      </div>
      <div className={cx("text-body", claim.isUnknown ? "italic text-slate" : "text-ink-black")}>
        {claim.isUnknown ? "Unknown: insufficient credible evidence" : claim.valueText}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EvidenceTab({ company, claims }: { company: Doc<"companies">; claims: Claim[] }) {
  const verifications = useQuery(api.companies.verificationsFor, { companyId: company._id }) ?? [];
  const followups = useQuery(api.companies.followupsFor, { companyId: company._id }) ?? [];
  const verify = useAction(api.pipeline.verifyCitation);
  const ask = useAction(api.pipeline.askFollowup);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const sources = useMemo(() => {
    const map = new Map<string, { url: string; title: string | null; excerpts: string[]; fields: Array<{ label: string; stage: string; text: string }> }>();
    for (const c of claims) {
      for (const cit of c.citations) {
        const s = map.get(cit.url) ?? { url: cit.url, title: cit.title ?? null, excerpts: [], fields: [] };
        for (const e of cit.excerpts) if (!s.excerpts.includes(e)) s.excerpts.push(e);
        if (!s.fields.some((f) => f.label === c.label && f.stage === c.stage)) s.fields.push({ label: c.label, stage: c.stage, text: c.valueText });
        map.set(cit.url, s);
      }
    }
    return [...map.values()].sort((a, b) => b.fields.length - a.fields.length);
  }, [claims]);

  const unsupported = claims.filter((c) => !c.isUnknown && c.citationCount === 0 && c.stage !== "discover");
  const conflicting = claims.filter((c) => c.conflicting);
  const unknowns = claims.filter((c) => c.isUnknown && c.stage !== "discover");
  const latestVerification = (url: string) => verifications.find((v) => v.url === url);

  async function onVerify(url: string, claimText: string) {
    setVerifying(url);
    try {
      await verify({ companyId: company._id, url, claimText });
    } finally {
      setVerifying(null);
    }
  }

  async function onAsk() {
    if (!question.trim()) return;
    setAsking(true);
    setAskError(null);
    try {
      await ask({ companyId: company._id, question });
      setQuestion("");
    } catch (e) {
      setAskError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-10">
      <div className="col-span-12 lg:col-span-7">
        <SectionLabel>Sources ({sources.length})</SectionLabel>
        <div className="mt-3 divide-y divide-hairline border-t border-hairline">
          {sources.length === 0 && <p className="py-4 text-small text-slate">No citations yet.</p>}
          {sources.map((s) => {
            const v = latestVerification(s.url);
            return (
              <div key={s.url} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <a href={s.url} target="_blank" rel="noreferrer" className="block truncate font-serif text-base text-ink-black hover:text-schematic-blue">
                      {s.title || hostname(s.url)}
                    </a>
                    <div className="chrome mt-0.5 truncate text-caption text-slate">{s.url}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {v && (
                      <Tag tone={v.status === "confirmed" ? "green" : v.status === "not_found" ? "amber" : "red"}>
                        {v.status === "confirmed" ? "Verified live" : v.status === "not_found" ? "Passage not found" : "Fetch failed"}
                      </Tag>
                    )}
                    <Button variant="ghost" onClick={() => onVerify(s.url, s.fields[0]?.text ?? "")} disabled={verifying === s.url}>
                      {verifying === s.url ? "Fetching…" : "Verify"}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.fields.map((f) => (
                    <Tag key={`${f.stage}-${f.label}`} tone="fog">
                      {f.stage} · {f.label}
                    </Tag>
                  ))}
                </div>
                {s.excerpts.slice(0, 2).map((e, i) => (
                  <blockquote key={i} className="mt-2 border-l border-hairline pl-3 text-small text-graphite">
                    {e.length > 420 ? `${e.slice(0, 420)}…` : e}
                  </blockquote>
                ))}
                {v && v.status === "confirmed" && v.excerpts[0] && (
                  <blockquote className="mt-2 border-l-2 border-status-green pl-3 text-small text-ink-black">
                    <span className="chrome text-caption text-status-green">Live excerpt via Extract </span>
                    {v.excerpts[0].length > 420 ? `${v.excerpts[0].slice(0, 420)}…` : v.excerpts[0]}
                  </blockquote>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-12 space-y-8 lg:col-span-5">
        <div>
          <SectionLabel>Ask a follow-up</SectionLabel>
          <p className="mt-2 text-small text-slate">Answered by Parallel&apos;s Responses API at low effort. About ten seconds and one cent.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAsk()}
              placeholder="Is this company gaining enterprise adoption?"
              className="min-w-0 flex-1 rounded-sm border border-hairline bg-pure-white px-3 py-2 font-serif text-body text-ink-black outline-none focus:border-ink-black"
            />
            <Button variant="dark" onClick={onAsk} disabled={asking || !question.trim()}>
              {asking ? "Researching…" : "Ask"}
            </Button>
          </div>
          {askError && <p className="mt-2 text-small text-status-red">{askError}</p>}
          <div className="mt-4 space-y-4">
            {followups.map((f) => (
              <div key={f._id} className="border-t border-hairline pt-3">
                <p className="font-serif text-body font-medium text-ink-black">{f.question}</p>
                <p className="mt-1 font-serif text-body text-graphite">{f.answer}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ConfidenceTag confidence={f.confidence} />
                  <Tag tone={f.evidenceStatus === "supported" ? "green" : f.evidenceStatus === "partial" ? "amber" : "fog"}>{f.evidenceStatus}</Tag>
                  <span className="chrome tnum text-caption text-slate">
                    {(f.latencyMs / 1000).toFixed(1)}s · {usd(f.costUsd)}
                  </span>
                </div>
                {f.citations.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {f.citations.slice(0, 5).map((c) => (
                      <li key={c.url} className="truncate text-caption">
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-schematic-blue hover:underline">
                          {c.title || hostname(c.url)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <FlagList title="Unsupported claims" tone="red" claims={unsupported} empty="Every non-null field has at least one citation." />
        <FlagList title="Conflicting evidence" tone="amber" claims={conflicting} empty="No field reasoning mentions conflicting sources." />
        <FlagList title="Unknowns" tone="fog" claims={unknowns} empty="No fields returned as unknown." />
      </div>
    </div>
  );
}

function FlagList({ title, tone, claims, empty }: { title: string; tone: "red" | "amber" | "fog"; claims: Claim[]; empty: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <SectionLabel>{title}</SectionLabel>
        <Tag tone={claims.length > 0 ? tone : "fog"}>{claims.length}</Tag>
      </div>
      {claims.length === 0 ? (
        <p className="mt-2 text-small text-slate">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
          {claims.map((c) => (
            <li key={c._id} className="py-2">
              <div className="chrome text-caption text-graphite">
                {c.stage} · {c.label}
              </div>
              {!c.isUnknown && <p className="mt-0.5 line-clamp-2 text-small text-ink-black">{c.valueText}</p>}
              {c.conflicting && c.reasoning && <p className="mt-0.5 line-clamp-2 text-caption text-slate">{c.reasoning}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
