"use client";

import { useAction, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { hostname, millions, usd } from "@/lib/format";
import { orderCompanies } from "@/lib/order";
import { DILIGENCE_SECTIONS } from "@/lib/parallel/specs";
import { Nav } from "./nav";
import { Button, ButtonLink, CLASS_LABEL, DecisionControl, Empty, Eyebrow, Meta, Page, Spinner, cx } from "./ui";

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
  const siblings = useQuery(api.companies.forRun, { runId });

  const ordered = useMemo(() => orderCompanies(siblings ?? []), [siblings]);
  const idx = ordered.findIndex((c) => c._id === companyId);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  if (company === undefined || run === undefined) return <Shell>Loading…</Shell>;
  if (!company || !run) return <Shell>Company not found.</Shell>;

  const all = claims ?? [];
  const discover = all.filter((c) => c.stage === "discover");
  const screen = all.filter((c) => c.stage === "screen");
  const diligence = all.filter((c) => c.stage === "diligence");
  const isDiligence = diligence.length > 0;
  const memo = isDiligence ? diligence : screen;
  const sources = collectSources([...discover, ...screen, ...diligence]);
  const indexOf = (url: string) => sources.findIndex((s) => s.url === url) + 1;
  const by = new Map(memo.map((c) => [c.field, c]));
  const order = isDiligence ? DILIGENCE_SECTIONS : SCREEN_ORDER;
  const sections = order.map((f) => by.get(f)).filter(Boolean) as Claim[];

  const researched = [...screen, ...diligence];
  const supported = researched.filter((c) => c.supported).length;
  const unknown = researched.filter((c) => c.isUnknown).length;
  const conflicting = researched.filter((c) => c.conflicting).length;
  const unsupported = researched.filter((c) => !c.isUnknown && c.citationCount === 0).length;

  return (
    <>
      <Nav />
      <Page width="wide">
        {/* Run bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ButtonLink href={`/runs/${runId}`} variant="ghost">
            ← Back to run
          </ButtonLink>
          <div className="flex items-center gap-2">
            {prev ? (
              <ButtonLink href={`/runs/${runId}/companies/${prev._id}`} variant="ghost">
                ← {prev.name}
              </ButtonLink>
            ) : null}
            {next ? (
              <ButtonLink href={`/runs/${runId}/companies/${next._id}`} variant="ghost">
                {next.name} →
              </ButtonLink>
            ) : null}
          </div>
        </div>

        {/* Header */}
        <div className="mt-10 max-w-[760px]">
          <h1 className="t-display text-ink-black">{company.name}</h1>
          <Meta className="mt-3">
            <a href={company.url} target="_blank" rel="noreferrer" className="text-schematic-blue hover:underline">
              {hostname(company.url)}
            </a>
            {" · "}
            {statusLine(company)}
          </Meta>
          {company.description && <p className="t-lead mt-5 text-graphite">{company.description}</p>}
        </div>

        {isDiligence && <Facts claims={diligence} />}

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[220px_1fr]">
          {/* Side rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>Your call</Eyebrow>
            <div className="mt-3">
              <DecisionControl company={company} size="md" />
            </div>
            <WatchButton company={company} />

            <Eyebrow className="mt-10">Evidence</Eyebrow>
            <dl className="t-mono mt-3 space-y-1 text-graphite">
              <Stat k="Supported" v={supported} />
              <Stat k="Unknown" v={unknown} tone={unknown > 0 ? "muted" : undefined} />
              <Stat k="Conflicting" v={conflicting} tone={conflicting > 0 ? "amber" : undefined} />
              <Stat k="Unsupported" v={unsupported} tone={unsupported > 0 ? "red" : undefined} />
              <Stat k="Sources" v={sources.length} />
            </dl>

            {sections.length > 0 && (
              <>
                <Eyebrow className="mt-10">Sections</Eyebrow>
                <nav className="mt-3 flex flex-col gap-1.5">
                  {sections.map((c) => (
                    <a key={c._id} href={`#${c.field}`} className="t-small text-graphite hover:text-ink-black">
                      {c.label}
                    </a>
                  ))}
                  <a href="#sources" className="t-small text-graphite hover:text-ink-black">
                    Sources
                  </a>
                  <a href="#followup" className="t-small text-graphite hover:text-ink-black">
                    Ask a follow-up
                  </a>
                  {discover.length > 0 && (
                    <a href="#discovery" className="t-small text-graphite hover:text-ink-black">
                      Discovery match
                    </a>
                  )}
                </nav>
              </>
            )}
          </aside>

          {/* Main */}
          <div className="min-w-0 max-w-[720px]">
            {sections.length === 0 ? (
              <Empty>
                {company.screen && company.screen.status !== "completed" ? (
                  <>
                    <Spinner /> Screening in progress.
                  </>
                ) : (
                  "Matched at discovery but not ranked into the screening set, so no research was spent."
                )}
              </Empty>
            ) : (
              <article>
                {!isDiligence && company.screenReasons && (
                  <p className="t-body mb-10 text-ink-black">
                    {company.screenClassification && <span className="font-medium">{CLASS_LABEL[company.screenClassification]}. </span>}
                    {company.screenReasons.join(". ")}.
                  </p>
                )}
                {isDiligence && <Meta className="mb-10">Pre-diligence brief, researched for {usd(0.1)}. Numbers in brackets are sources.</Meta>}
                <div className="space-y-12">
                  {sections.map((c) => (
                    <Section key={c._id} claim={c} indexOf={indexOf} />
                  ))}
                </div>
              </article>
            )}

            <Sources sources={sources} company={company} />
            <Followups company={company} />
            <Discovery claims={discover} company={company} indexOf={indexOf} />
          </div>
        </div>
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

function Stat({ k, v, tone }: { k: string; v: number; tone?: "muted" | "amber" | "red" }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate">{k}</dt>
      <dd className={cx("tnum", tone === "amber" && "text-status-amber", tone === "red" && "text-status-red", !tone && "text-ink-black", tone === "muted" && "text-graphite")}>{v}</dd>
    </div>
  );
}

function statusLine(c: Doc<"companies">): string {
  const parts: string[] = [];
  if (c.priorityRank !== undefined) parts.push(`ranked ${c.priorityRank} at discovery`);
  if (c.screenClassification) parts.push(`${CLASS_LABEL[c.screenClassification].toLowerCase()} at screen`);
  if (c.diligence?.status === "completed") parts.push("deep brief complete");
  else if (c.diligence && c.diligence.status !== "failed") parts.push("deep brief running");
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */

function WatchButton({ company }: { company: Doc<"companies"> }) {
  const watch = useAction(api.pipeline.watchCompany);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onWatch() {
    setBusy(true);
    try {
      const res = await watch({ companyId: company._id });
      setMsg(res.message);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3">
      <Button variant="ghost" onClick={onWatch} disabled={busy} className="w-full">
        {busy ? "Requesting…" : company.monitorId ? "Watching weekly" : "Watch weekly"}
      </Button>
      {msg && <p className="t-small mt-2 text-graphite">{msg}</p>}
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
  items.push(["Headquarters", hq && !hq.isUnknown ? hq.valueText : "Unknown"]);
  items.push(["Founded", founded && !founded.isUnknown ? founded.valueText : "Unknown"]);
  items.push(["Team", emp && !emp.isUnknown ? emp.valueText.split(/[;(]/)[0].trim() : "Unknown"]);
  items.push(["Raised", raised && !raised.isUnknown ? millions(raised.value) : "Unknown"]);
  items.push(["Valuation", val && !val.isUnknown ? millions(val.value) : "Unknown"]);
  return (
    <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-hairline pt-5 md:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="t-mono-up text-slate">{k}</dt>
          <dd className={cx("t-body mt-2", v === "Unknown" ? "italic text-slate" : "text-ink-black")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */

function Section({ claim, indexOf }: { claim: Claim; indexOf: (url: string) => number }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const refs = claim.citations.map((c) => indexOf(c.url)).filter((n) => n > 0);
  return (
    <section id={claim.field} className="scroll-mt-24">
      <h2 className="t-body font-medium text-ink-black">{claim.label}</h2>
      <div className="mt-2">
        <ClaimValue claim={claim} />
        {refs.length > 0 && (
          <span className="t-mono ml-1 text-schematic-blue">
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
            <span className={cx(claim.confidence === "low" && "text-status-amber")}>{claim.confidence ? `${claim.confidence} confidence` : "no confidence given"}</span>
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
      {showReasoning && <p className="t-small mt-2 text-graphite">{claim.reasoning}</p>}
    </section>
  );
}

function ClaimValue({ claim }: { claim: Claim }) {
  if (claim.isUnknown) return <p className="t-body italic text-slate">Unknown: insufficient credible evidence.</p>;
  const v = claim.value;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return <span className="t-body text-ink-black">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string")) {
      return (
        <ul className="t-body list-disc space-y-1 pl-5 text-ink-black">
          {(v as string[]).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      );
    }
    const rows = v as Array<Record<string, unknown>>;
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return (
      <table className="t-small w-full">
        <thead>
          <tr className="t-mono text-slate">
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
                <td key={k} className={cx("py-1.5 pr-4 text-ink-black", typeof r[k] === "number" && "tnum")}>
                  {r[k] === null || r[k] === undefined ? <span className="text-slate">—</span> : String(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <span className="t-body text-ink-black">{claim.valueText}</span>;
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

function Sources({ sources, company }: { sources: Source[]; company: Doc<"companies"> }) {
  const verifications = useQuery(api.companies.verificationsFor, { companyId: company._id }) ?? [];
  const verify = useAction(api.pipeline.verifyCitation);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (sources.length === 0) return null;

  async function onVerify(s: Source) {
    setVerifying(s.url);
    try {
      await verify({ companyId: company._id, url: s.url, claimText: s.excerpts[0]?.slice(0, 300) ?? s.fields[0] });
    } finally {
      setVerifying(null);
    }
  }

  return (
    <section id="sources" className="mt-16 scroll-mt-24 border-t border-hairline pt-8">
      <h2 className="t-title text-ink-black">Sources</h2>
      <Meta className="mt-1">Every number in brackets above points here. Verify fetches the page live and checks the passage is still there.</Meta>
      <ol className="mt-5 space-y-3">
        {sources.map((s, i) => {
          const v = verifications.find((x) => x.url === s.url);
          const isOpen = open === s.url;
          return (
            <li key={s.url} id={`source-${i + 1}`} className="flex scroll-mt-24 gap-3">
              <span className="t-mono tnum w-7 shrink-0 text-slate">[{i + 1}]</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <a href={s.url} target="_blank" rel="noreferrer" className="t-small truncate text-ink-black hover:text-schematic-blue">
                    {s.title || hostname(s.url)}
                  </a>
                  <span className="t-mono flex shrink-0 gap-3">
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
                  <blockquote className="t-small mt-2 border-l border-hairline pl-3 text-graphite">
                    {s.excerpts[0].length > 600 ? `${s.excerpts[0].slice(0, 600)}…` : s.excerpts[0]}
                  </blockquote>
                )}
                {v?.status === "confirmed" && v.excerpts[0] && (
                  <blockquote className="t-small mt-2 border-l border-status-green pl-3 text-graphite">
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
    <section id="followup" className="mt-16 scroll-mt-24 border-t border-hairline pt-8">
      <h2 className="t-title text-ink-black">Ask a follow-up</h2>
      <Meta className="mt-1">Answered from the live web with sources. About ten seconds and one cent.</Meta>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onAsk();
        }}
        className="mt-5 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Is this company gaining enterprise adoption?"
          className="t-body h-9 min-w-0 flex-1 rounded-sm border border-hairline bg-pure-white px-3 text-ink-black outline-none focus:border-ink-black"
        />
        <Button type="submit" variant="dark" disabled={asking || !question.trim()}>
          {asking ? "Researching…" : "Ask"}
        </Button>
      </form>
      {error && <p className="t-small mt-2 text-status-red">{error}</p>}
      <div className="mt-6 space-y-6">
        {followups.map((f) => (
          <div key={f._id}>
            <p className="t-body font-medium text-ink-black">{f.question}</p>
            <p className="t-body mt-1 text-graphite">{f.answer}</p>
            <Meta className="tnum mt-1">
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
    <section id="discovery" className="mt-16 scroll-mt-24 border-t border-hairline pt-8">
      <h2 className="t-title text-ink-black">Discovery match</h2>
      {company.priorityReasons && <Meta className="mt-1">{company.priorityReasons.join(" · ")}</Meta>}
      <ul className="mt-5 space-y-4">
        {claims.map((c) => {
          const refs = c.citations.map((x) => indexOf(x.url)).filter((n) => n > 0);
          return (
            <li key={c._id}>
              <p className="t-body text-ink-black">
                <span className="font-medium">{c.field.replace(/_check$/, "").replace(/_/g, " ")}.</span> {c.reasoning || c.valueText}
                {refs.length > 0 && (
                  <span className="t-mono ml-1 text-schematic-blue">
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
    </section>
  );
}
