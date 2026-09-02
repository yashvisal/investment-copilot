"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { hostname, millions, usd } from "@/lib/format";
import { DILIGENCE_SECTIONS } from "@/lib/parallel/specs";
import type { Decision } from "@/lib/parallel/types";
import { Nav } from "./nav";
import { Button, CLASS_LABEL, DECISION_LABEL, Empty, Meta, Page, Spinner, cx } from "./ui";

type Claim = Doc<"claims">;

const SCREEN_ORDER = [
  "what_it_sells",
  "target_customer",
  "enterprise_traction",
  "recent_momentum",
  "latest_funding_round",
  "latest_funding_amount_usd_millions",
  "latest_funding_date",
  "total_raised_usd_millions",
  "founded_year",
  "thesis_concern",
];

export function CompanyView({ runId, companyId }: { runId: Id<"runs">; companyId: Id<"companies"> }) {
  const run = useQuery(api.runs.get, { runId });
  const company = useQuery(api.companies.get, { companyId });
  const claims = useQuery(api.companies.claimsFor, { companyId });

  if (company === undefined || run === undefined) return <Shell>Loading…</Shell>;
  if (!company || !run) return <Shell>Company not found.</Shell>;

  const all = claims ?? [];
  const discover = all.filter((c) => c.stage === "discover");
  const screen = all.filter((c) => c.stage === "screen");
  const diligence = all.filter((c) => c.stage === "diligence");
  const memo = diligence.length > 0 ? diligence : screen;
  const sources = collectSources([...discover, ...screen, ...diligence]);
  const indexOf = (url: string) => sources.findIndex((s) => s.url === url) + 1;

  return (
    <>
      <Nav />
      <Page>
        <Link href={`/runs/${runId}`} className="mt-8 inline-block font-mono text-ui text-slate hover:text-ink-black">
          ← Run
        </Link>

        <h1 className="mt-4 text-heading font-medium leading-[1.11] text-ink-black">{company.name}</h1>
        <Meta className="mt-2">
          <a href={company.url} target="_blank" rel="noreferrer" className="text-schematic-blue hover:underline">
            {hostname(company.url)}
          </a>
          {" · "}
          {statusLine(company)}
        </Meta>
        {company.description && <p className="mt-5 max-w-[620px] text-base leading-[1.6] text-graphite">{company.description}</p>}

        <DecisionRow company={company} />

        {company.diligence?.status === "completed" && <Facts claims={diligence} />}

        {memo.length === 0 ? (
          <Empty>
            {company.screen && company.screen.status !== "completed" ? (
              <>
                <Spinner /> Screening on the {company.screen.processor} processor.
              </>
            ) : (
              "Matched by FindAll but not ranked into the screening set, so no research was spent."
            )}
          </Empty>
        ) : (
          <Memo company={company} claims={memo} isDiligence={diligence.length > 0} indexOf={indexOf} />
        )}

        <Sources sources={sources} company={company} claims={all} />
        <Followups company={company} />
        <Discovery claims={discover} company={company} indexOf={indexOf} />
      </Page>
    </>
  );
}

function Shell({ children }: { children: string }) {
  return (
    <>
      <Nav />
      <Page>
        <Empty>{children}</Empty>
      </Page>
    </>
  );
}

function statusLine(c: Doc<"companies">): string {
  const parts: string[] = [];
  if (c.priorityRank !== undefined) parts.push(`ranked ${c.priorityRank} at discovery`);
  if (c.screenClassification) parts.push(`${CLASS_LABEL[c.screenClassification].toLowerCase()} at screen`);
  if (c.diligence?.status === "completed") parts.push("diligenced on pro");
  else if (c.diligence && c.diligence.status !== "failed") parts.push("diligence running");
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */

function DecisionRow({ company }: { company: Doc<"companies"> }) {
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
    <div className="mt-8 border-y border-hairline py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="text-body text-graphite">Worth more human research?</span>
        <div className="flex gap-1">
          {(["pass", "watch", "deep_diligence"] as Decision[]).map((d) => (
            <button
              key={d}
              onClick={() => setDecision({ companyId: company._id, decision: company.decision === d ? null : d })}
              className={cx(
                "rounded-sm px-3 py-1.5 font-mono text-ui uppercase transition-colors",
                company.decision === d ? "bg-ink-black text-pure-white" : "text-graphite hover:bg-fog",
              )}
            >
              {DECISION_LABEL[d]}
            </button>
          ))}
        </div>
        <button onClick={onWatch} disabled={watching} className="ml-auto font-mono text-ui text-slate hover:text-ink-black disabled:opacity-40">
          {watching ? "Requesting…" : company.monitorId ? "Watching weekly" : "Watch with Parallel Monitor"}
        </button>
      </div>
      {watchMsg && <p className="mt-3 text-small text-graphite">{watchMsg}</p>}
    </div>
  );
}

function Facts({ claims }: { claims: Claim[] }) {
  const by = new Map(claims.map((c) => [c.field, c]));
  const items: Array<[string, string]> = [];
  const hq = by.get("headquarters");
  const founded = by.get("founded_year");
  const emp = by.get("employee_count");
  const raised = by.get("total_raised_usd_millions");
  const val = by.get("latest_valuation_usd_millions");
  if (hq && !hq.isUnknown) items.push(["HQ", hq.valueText]);
  if (founded && !founded.isUnknown) items.push(["Founded", founded.valueText]);
  if (emp && !emp.isUnknown) items.push(["Team", emp.valueText.split(/[;(]/)[0].trim()]);
  if (raised && !raised.isUnknown) items.push(["Raised", millions(raised.value)]);
  if (val && !val.isUnknown) items.push(["Valuation", millions(val.value)]);
  if (items.length === 0) return null;
  return (
    <Meta className="mt-6 flex flex-wrap gap-x-5 gap-y-1">
      {items.map(([k, v]) => (
        <span key={k}>
          <span className="text-slate">{k}</span> <span className="text-ink-black">{v}</span>
        </span>
      ))}
    </Meta>
  );
}

/* ------------------------------------------------------------------ */

function Memo({ company, claims, isDiligence, indexOf }: { company: Doc<"companies">; claims: Claim[]; isDiligence: boolean; indexOf: (url: string) => number }) {
  const by = useMemo(() => new Map(claims.map((c) => [c.field, c])), [claims]);
  const order = isDiligence ? DILIGENCE_SECTIONS : SCREEN_ORDER;
  const ordered = order.map((f) => by.get(f)).filter(Boolean) as Claim[];

  return (
    <article className="mt-10">
      {!isDiligence && company.screenReasons && (
        <p className="mb-8 text-base leading-[1.6] text-ink-black">
          {company.screenClassification && <span className="font-medium">{CLASS_LABEL[company.screenClassification]}. </span>}
          {company.screenReasons.join(". ")}.
        </p>
      )}
      {company.diligence?.status === "completed" && (
        <Meta className="mb-8">Pre-diligence brief researched by Parallel on the pro processor for {usd(0.1)}. Numbers in brackets are sources.</Meta>
      )}
      <div className="space-y-9">
        {ordered.map((c) => (
          <Section key={c._id} claim={c} indexOf={indexOf} />
        ))}
      </div>
    </article>
  );
}

function Section({ claim, indexOf }: { claim: Claim; indexOf: (url: string) => number }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const refs = claim.citations.map((c) => indexOf(c.url)).filter((n) => n > 0);
  return (
    <section>
      <h2 className="text-base font-medium text-ink-black">{claim.label}</h2>
      <div className="mt-2 max-w-[620px]">
        <ClaimValue claim={claim} />
        {refs.length > 0 && (
          <span className="ml-1 font-mono text-ui text-schematic-blue">
            {refs.map((n) => (
              <a key={n} href={`#source-${n}`} className="mr-1 hover:underline">
                [{n}]
              </a>
            ))}
          </span>
        )}
      </div>
      <Meta className="mt-2 flex flex-wrap gap-x-3">
        {claim.isUnknown ? (
          <span>no credible evidence</span>
        ) : (
          <>
            <span className={cx(claim.confidence === "low" && "text-status-amber")}>
              {claim.confidence ? `${claim.confidence} confidence` : "no confidence given"}
            </span>
            {claim.citationCount === 0 && <span className="text-status-red">unsupported</span>}
            {claim.conflicting && <span className="text-status-amber">sources conflict</span>}
          </>
        )}
        {claim.reasoning && (
          <button onClick={() => setShowReasoning((s) => !s)} className="text-slate hover:text-ink-black">
            {showReasoning ? "hide reasoning" : "reasoning"}
          </button>
        )}
      </Meta>
      {showReasoning && <p className="mt-2 max-w-[620px] text-small leading-[1.5] text-graphite">{claim.reasoning}</p>}
    </section>
  );
}

function ClaimValue({ claim }: { claim: Claim }) {
  if (claim.isUnknown) return <p className="text-base italic text-slate">Unknown: insufficient credible evidence.</p>;
  const v = claim.value;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return <span className="text-base leading-[1.65] text-ink-black">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string")) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-base leading-[1.6] text-ink-black">
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
          <tr className="font-mono text-ui text-slate">
            {keys.map((k) => (
              <th key={k} className="pb-1 pr-4 text-left font-normal">
                {k.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline border-t border-hairline">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {keys.map((k) => (
                <td key={k} className={cx("py-1.5 pr-4 text-body text-ink-black", typeof r[k] === "number" && "tnum")}>
                  {r[k] === null || r[k] === undefined ? <span className="text-slate">—</span> : String(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <span className="text-base text-ink-black">{claim.valueText}</span>;
}

/* ------------------------------------------------------------------ */

type Source = { url: string; title: string | null; excerpts: string[]; fields: string[] };

function collectSources(claims: Claim[]): Source[] {
  const map = new Map<string, Source>();
  for (const c of claims) {
    for (const cit of c.citations) {
      const s = map.get(cit.url) ?? { url: cit.url, title: cit.title ?? null, excerpts: [], fields: [] };
      for (const e of cit.excerpts) if (!s.excerpts.includes(e)) s.excerpts.push(e);
      if (!s.fields.includes(c.label)) s.fields.push(c.label);
      map.set(cit.url, s);
    }
  }
  return [...map.values()];
}

function Sources({ sources, company, claims }: { sources: Source[]; company: Doc<"companies">; claims: Claim[] }) {
  const verifications = useQuery(api.companies.verificationsFor, { companyId: company._id }) ?? [];
  const verify = useAction(api.pipeline.verifyCitation);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (sources.length === 0) return null;

  const unsupported = claims.filter((c) => !c.isUnknown && c.citationCount === 0 && c.stage !== "discover").length;
  const conflicting = claims.filter((c) => c.conflicting).length;
  const unknown = claims.filter((c) => c.isUnknown && c.stage !== "discover").length;

  async function onVerify(s: Source) {
    setVerifying(s.url);
    try {
      await verify({ companyId: company._id, url: s.url, claimText: s.excerpts[0]?.slice(0, 300) ?? s.fields[0] });
    } finally {
      setVerifying(null);
    }
  }

  return (
    <section className="mt-14 border-t border-hairline pt-6">
      <h2 className="text-base font-medium text-ink-black">Sources</h2>
      <Meta className="mt-1">
        {sources.length} sources across {claims.length} researched fields
        {unsupported > 0 && ` · ${unsupported} unsupported`}
        {conflicting > 0 && ` · ${conflicting} with conflicting evidence`}
        {unknown > 0 && ` · ${unknown} unknown`}
      </Meta>
      <ol className="mt-4 space-y-3">
        {sources.map((s, i) => {
          const v = verifications.find((x) => x.url === s.url);
          const isOpen = open === s.url;
          return (
            <li key={s.url} id={`source-${i + 1}`} className="flex gap-3 text-small">
              <span className="tnum w-6 shrink-0 font-mono text-ui text-slate">[{i + 1}]</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-body text-ink-black hover:text-schematic-blue">
                    {s.title || hostname(s.url)}
                  </a>
                  <span className="flex shrink-0 gap-3 font-mono text-ui">
                    {v && (
                      <span className={v.status === "confirmed" ? "text-status-green" : "text-status-amber"}>
                        {v.status === "confirmed" ? "verified live" : v.status === "not_found" ? "passage not found" : "fetch failed"}
                      </span>
                    )}
                    {s.excerpts.length > 0 && (
                      <button onClick={() => setOpen(isOpen ? null : s.url)} className="text-slate hover:text-ink-black">
                        {isOpen ? "hide" : "excerpt"}
                      </button>
                    )}
                    <button onClick={() => onVerify(s)} disabled={verifying === s.url} className="text-slate hover:text-ink-black disabled:opacity-40">
                      {verifying === s.url ? "fetching…" : "verify"}
                    </button>
                  </span>
                </div>
                <Meta className="truncate">
                  {hostname(s.url)} · {s.fields.slice(0, 3).join(", ")}
                  {s.fields.length > 3 && ` +${s.fields.length - 3}`}
                </Meta>
                {isOpen && (
                  <blockquote className="mt-2 border-l border-hairline pl-3 text-small leading-[1.5] text-graphite">
                    {s.excerpts[0].length > 600 ? `${s.excerpts[0].slice(0, 600)}…` : s.excerpts[0]}
                  </blockquote>
                )}
                {v?.status === "confirmed" && v.excerpts[0] && (
                  <blockquote className="mt-2 border-l border-status-green pl-3 text-small leading-[1.5] text-graphite">
                    {v.excerpts[0].length > 400 ? `${v.excerpts[0].slice(0, 400)}…` : v.excerpts[0]}
                  </blockquote>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Followups({ company }: { company: Doc<"companies"> }) {
  const followups = useQuery(api.companies.followupsFor, { companyId: company._id }) ?? [];
  const ask = useAction(api.pipeline.askFollowup);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAsk() {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      await ask({ companyId: company._id, question });
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="mt-14 border-t border-hairline pt-6">
      <h2 className="text-base font-medium text-ink-black">Ask a follow-up</h2>
      <Meta className="mt-1">Answered live by Parallel&apos;s Responses API. About ten seconds and one cent.</Meta>
      <div className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAsk()}
          placeholder="Is this company gaining enterprise adoption?"
          className="min-w-0 flex-1 rounded-sm border border-hairline bg-pure-white px-3 py-2 text-body text-ink-black outline-none focus:border-ink-black"
        />
        <Button variant="dark" onClick={onAsk} disabled={asking || !question.trim()}>
          {asking ? "Researching…" : "Ask"}
        </Button>
      </div>
      {error && <p className="mt-2 text-small text-status-red">{error}</p>}
      <div className="mt-6 space-y-6">
        {followups.map((f) => (
          <div key={f._id}>
            <p className="text-body font-medium text-ink-black">{f.question}</p>
            <p className="mt-1 max-w-[620px] text-body leading-[1.6] text-graphite">{f.answer}</p>
            <Meta className="mt-1 tnum">
              {f.confidence ? `${f.confidence} confidence` : ""} · {f.evidenceStatus} · {(f.latencyMs / 1000).toFixed(1)}s · {usd(f.costUsd)}
              {f.citations.slice(0, 4).map((c) => (
                <span key={c.url}>
                  {" · "}
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-schematic-blue hover:underline">
                    {hostname(c.url)}
                  </a>
                </span>
              ))}
            </Meta>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Discovery({ claims, company, indexOf }: { claims: Claim[]; company: Doc<"companies">; indexOf: (url: string) => number }) {
  if (claims.length === 0) return null;
  return (
    <details className="mt-14 border-t border-hairline pt-6">
      <summary className="cursor-pointer list-none text-base font-medium text-ink-black">How FindAll matched it</summary>
      {company.priorityReasons && <Meta className="mt-1">{company.priorityReasons.join(" · ")}</Meta>}
      <ul className="mt-4 space-y-4">
        {claims.map((c) => {
          const refs = c.citations.map((x) => indexOf(x.url)).filter((n) => n > 0);
          return (
            <li key={c._id} className="max-w-[620px]">
              <p className="text-body text-ink-black">
                <span className="font-medium">{c.field.replace(/_check$/, "").replace(/_/g, " ")}.</span> {c.reasoning || c.valueText}
                {refs.length > 0 && (
                  <span className="ml-1 font-mono text-ui text-schematic-blue">
                    {refs.map((n) => (
                      <a key={n} href={`#source-${n}`} className="mr-1 hover:underline">
                        [{n}]
                      </a>
                    ))}
                  </span>
                )}
              </p>
              <Meta className="mt-0.5">{c.confidence ? `${c.confidence} confidence` : ""}</Meta>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
