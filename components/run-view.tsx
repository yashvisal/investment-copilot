"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { elapsed, hostname, millions, timeOfDay, usd } from "@/lib/format";
import { BUCKET_LABEL, bucketOf, firstSentences, orderCompanies, stripVerdictLead, type Bucket } from "@/lib/order";
import { CLASS_LABEL, DecisionControl, Empty, Eyebrow, Meta, Page, Skeleton, SkeletonCard, Spinner, Wire, cx, type WireNode } from "./ui";
import { Nav } from "./nav";

type StageKey = "discover" | "prioritize" | "screen" | "diligence";
const STAGE_ORDER: StageKey[] = ["discover", "prioritize", "screen", "diligence"];
const STAGE_LABEL: Record<StageKey, string> = { discover: "Discovering", prioritize: "Prioritizing", screen: "Screening", diligence: "Diligence" };
const BUCKETS: Bucket[] = ["finalists", "cleared", "passed", "unscreened"];

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function RunView({ runId }: { runId: Id<"runs"> }) {
  const run = useQuery(api.runs.get, { runId });
  const companies = useQuery(api.companies.forRun, { runId });
  const events = useQuery(api.events.forRun, { runId });
  const active = !!run && run.status !== "complete" && run.status !== "failed";
  const now = useNow(active);
  const ordered = useMemo(() => orderCompanies(companies ?? []), [companies]);
  const unmatched = (companies ?? []).filter((c) => c.matchStatus !== "matched");

  if (run === undefined) return <RunSkeleton />;
  if (run === null) return <Shell>Run not found.</Shell>;

  const groups = BUCKETS.map((b) => ({ bucket: b, rows: ordered.filter((c) => bucketOf(c) === b) })).filter((g) => g.rows.length > 0);

  return (
    <>
      <Nav />
      <Page>
        <div className="max-w-[760px]">
          <Eyebrow>Thesis</Eyebrow>
          <h1 className="t-title mt-3 text-ink-black">{run.thesis}</h1>
        </div>
        <Progress
          run={run}
          now={now}
          matched={ordered.length}
          checked={(companies ?? []).filter((c) => c.matchStatus !== "generated").length}
        />
        {run.error && <p className="t-small mt-6 text-status-red">{run.error}</p>}

        {run.status === "discovering" && <DiscoveryFeed run={run} companies={companies ?? []} />}

        {ordered.length === 0 ? (
          run.status === "discovering" ? null : <Empty>No matched companies.</Empty>
        ) : (
          <div className="mt-14 space-y-12">
            {groups.map((g) => (
              <section key={g.bucket}>
                <div className="flex items-baseline gap-3">
                  <h2 className="t-body font-medium text-ink-black">{BUCKET_LABEL[g.bucket]}</h2>
                  <Meta className="tnum">{g.rows.length}</Meta>
                </div>
                <ol className="mt-4 space-y-3">
                  {g.rows.map((c) => (
                    <Row key={c._id} runId={run._id} c={c} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        {unmatched.length > 0 && run.status !== "discovering" && (
          <details className="mt-10">
            <summary className="t-mono cursor-pointer list-none text-slate hover:text-ink-black">
              {unmatched.length} more found at discovery and not matched
            </summary>
            <ul className="mt-3 max-w-[760px] space-y-1.5">
              {unmatched.map((c) => (
                <li key={c._id} className="t-small flex items-baseline justify-between gap-4 text-graphite">
                  <span>
                    {c.name} <span className="text-slate">{hostname(c.url)}</span>
                  </span>
                  <span className="shrink-0 text-slate">{failedCondition(c) ?? c.matchStatus}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <EventLog events={events ?? []} active={active} />
      </Page>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Discovery feed: what the search is looking at right now.            */
/* ------------------------------------------------------------------ */

const FEED_SIZE = 8;

function DiscoveryFeed({ run, companies }: { run: Doc<"runs">; companies: Doc<"companies">[] }) {
  const recent = [...companies].sort((a, b) => b._creationTime - a._creationTime).slice(0, FEED_SIZE);
  const found = run.generatedCount ?? companies.length;
  const checked = companies.filter((c) => c.matchStatus !== "generated").length;
  const matched = companies.filter((c) => c.matchStatus === "matched").length;

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="t-body font-medium text-ink-black">Candidates under review</h2>
          <Meta className="tnum">
            {found} found · {checked} checked · {matched} of {run.matchLimit} matched
          </Meta>
        </div>
        <Meta>Matches move up into the board as they are confirmed.</Meta>
      </div>

      <ol className="mt-4 space-y-2">
        <li className="flex items-center gap-4 rounded-sm border border-dashed border-hairline px-4 py-3">
          <Spinner />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="ml-auto h-3 w-28" />
        </li>
        {recent.map((c) => {
          const hit = c.matchStatus === "matched";
          return (
            <li key={c._id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-sm border border-hairline bg-pure-white px-4 py-3">
              <span className={cx("t-body font-medium", hit ? "text-ink-black" : "text-graphite")}>{c.name}</span>
              <Meta className="truncate">{hostname(c.url)}</Meta>
              <Meta className={cx("ml-auto shrink-0", hit && "text-signal-orange")}>
                {hit ? "Matched" : c.matchStatus === "generated" ? "Awaiting check" : (failedCondition(c) ?? "Not matched")}
              </Meta>
            </li>
          );
        })}
      </ol>
      {companies.length > FEED_SIZE && <Meta className="mt-3 tnum">{companies.length - FEED_SIZE} earlier candidates not shown.</Meta>}
    </section>
  );
}

function RunSkeleton() {
  return (
    <>
      <Nav />
      <Page>
        <Skeleton className="h-3 w-16" />
        <div className="mt-4 max-w-[760px] space-y-3">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
        </div>
        <div className="mt-12 flex max-w-[760px] gap-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        <Skeleton className="mt-8 h-4 w-96" />
        <Skeleton className="mt-16 h-4 w-24" />
        <div className="mt-4 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
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

/* ------------------------------------------------------------------ */

function Row({ runId, c }: { runId: Id<"runs">; c: Doc<"companies"> }) {
  const router = useRouter();
  const out = (c.screen?.output ?? {}) as Record<string, unknown>;
  const facts = [
    typeof out.latest_funding_round === "string" ? out.latest_funding_round : null,
    typeof out.total_raised_usd_millions === "number" ? `${millions(out.total_raised_usd_millions)} raised` : null,
    typeof out.founded_year === "number" ? `est. ${out.founded_year}` : null,
  ].filter(Boolean) as string[];

  const href = `/runs/${runId}/companies/${c._id}`;
  return (
    <li
      onClick={() => router.push(href)}
      className="group grid cursor-pointer grid-cols-1 gap-x-8 gap-y-3 rounded-sm border border-hairline bg-pure-white p-5 shadow-sm transition-colors hover:border-ink-black md:grid-cols-[240px_1fr_auto] md:items-start"
    >
      <div className="min-w-0">
        <Link href={href} className="t-body block font-medium text-ink-black group-hover:text-schematic-blue">
          {c.name}
        </Link>
        <Meta className="truncate">{hostname(c.url)}</Meta>
        {facts.length > 0 && <Meta className="tnum mt-1">{facts.join(" · ")}</Meta>}
      </div>
      <div className="min-w-0">
        <p className="t-small text-graphite">{why(c)}</p>
        <Meta className="mt-1">{statusWord(c)}</Meta>
      </div>
      <div className="md:pt-0.5" onClick={(e) => e.stopPropagation()}>
        <DecisionControl company={c} />
      </div>
    </li>
  );
}

function statusWord(c: Doc<"companies">): string {
  if (c.diligence?.status === "completed") return "Deep brief ready";
  if (c.diligence && (c.diligence.status === "queued" || c.diligence.status === "running")) return "Deep brief running";
  if (c.screen?.status === "completed" && c.screenClassification) return `${CLASS_LABEL[c.screenClassification]} at screen`;
  if (c.screen && (c.screen.status === "queued" || c.screen.status === "running")) return "Screening";
  if (c.priorityRank !== undefined) return `Ranked ${c.priorityRank} at discovery`;
  return "Matched at discovery";
}

/** Row copy: a plain overview of what the company does. Passes show why they were passed. */
function why(c: Doc<"companies">): string {
  const out = c.screen?.output as Record<string, unknown> | undefined;
  if (c.screenClassification === "pass" && c.screenReasons?.[0]) return c.screenReasons[0];
  if (typeof out?.what_it_sells === "string") return firstSentences(stripVerdictLead(out.what_it_sells as string), 2);
  if (c.description) return firstSentences(stripVerdictLead(c.description), 2);
  return "";
}

function failedCondition(c: Doc<"companies">): string | null {
  const out = c.matchOutput as Record<string, { is_matched?: boolean; value?: unknown }> | null | undefined;
  if (!out) return null;
  const failed = Object.entries(out).find(([, v]) => v && typeof v === "object" && v.is_matched === false);
  if (!failed) return null;
  const [name, v] = failed;
  const label = name.replace(/_check$/, "").replace(/_/g, " ");
  const val = typeof v.value === "string" && v.value.length < 40 ? `: ${v.value}` : "";
  return `failed ${label}${val}`;
}

/* ------------------------------------------------------------------ */

function Progress({ run, now, matched, checked }: { run: Doc<"runs">; now: number; matched: number; checked: number }) {
  const activeKey: StageKey | null =
    run.status === "discovering" ? "discover" : run.status === "prioritizing" ? "prioritize" : run.status === "screening" ? "screen" : run.status === "diligencing" ? "diligence" : null;
  const activeIdx = activeKey ? STAGE_ORDER.indexOf(activeKey) : run.status === "complete" ? 5 : -1;
  const stats = activeKey ? run.stages[activeKey] : null;
  const s = run.stages;

  function state(i: number): WireNode["state"] {
    if (run.status === "complete") return "done";
    if (i < activeIdx) return "done";
    if (i === activeIdx) return "active";
    return "pending";
  }

  const nodes: WireNode[] = [
    { label: "Discover", state: state(0), value: s.discover.startedAt ? `${s.discover.count ?? matched} · ${usd(s.discover.spendUsd ?? 0)}` : `${run.matchLimit} cap` },
    { label: "Prioritize", state: state(1), value: s.prioritize.startedAt ? `${s.prioritize.count ?? 0} · $0` : undefined },
    { label: "Screen", state: state(2), value: s.screen.startedAt ? `${s.screen.count ?? 0} · ${usd(s.screen.spendUsd ?? 0)}` : undefined },
    { label: "Diligence", state: state(3), value: s.diligence.startedAt ? `${s.diligence.count ?? 0} · ${usd(s.diligence.spendUsd ?? 0)}` : undefined },
    { label: "Decide", state: run.status === "complete" ? "active" : "pending", value: run.status === "complete" ? "your call" : undefined },
  ];

  let line: string;
  if (run.status === "complete") line = `Complete. ${s.discover.count ?? 0} discovered, ${s.screen.count ?? 0} screened, ${s.diligence.count ?? 0} diligenced. Mark each finalist below.`;
  else if (run.status === "failed") line = "The run stopped. See the log below.";
  else if (activeKey === "discover") line = `Discovering. ${matched} of ${run.matchLimit} matched, ${checked} checked, ${run.generatedCount ?? 0} candidates found.`;
  else if (activeKey === "prioritize") line = "Ranking matches on their discovery evidence.";
  else if (activeKey === "screen") line = `Screening ${s.prioritize.count ?? 0} companies at once. ${stats?.count ?? 0} done.`;
  else if (activeKey === "diligence") line = `Deep briefs running for ${run.diligenceLimit} finalists at once. ${stats?.count ?? 0} done.`;
  else line = "Queued.";

  return (
    <div className="mt-10 max-w-[760px]">
      <Wire nodes={nodes} />
      <p className="t-body mt-8 flex items-baseline gap-2 text-ink-black">
        {activeKey && <Spinner />}
        <span>{line}</span>
      </p>
      <Meta className="tnum mt-1">
        {activeKey && stats?.startedAt ? `${STAGE_LABEL[activeKey]} for ${elapsed(stats.startedAt, undefined, now)} · ` : ""}
        {usd(run.spendUsd)} spent of {usd(run.estimatedCostUsd)} estimated
      </Meta>
    </div>
  );
}

function EventLog({ events, active }: { events: Doc<"events">[]; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [events.length, open]);
  const last = events[events.length - 1];
  return (
    <div className="mt-12 border-t border-hairline pt-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-baseline justify-between gap-4 text-left">
        <span className="t-mono text-slate hover:text-ink-black">{open ? "Hide log" : "Log"}</span>
        {!open && last && (
          <span className="t-mono min-w-0 flex-1 truncate text-slate">
            {active && <Spinner />} {last.message}
          </span>
        )}
      </button>
      {open && (
        <div ref={ref} className="t-mono mt-3 max-h-[420px] overflow-y-auto rounded-sm bg-ink-black p-4 text-pure-white/80">
          {events.map((e) => (
            <div key={e._id} className="grid grid-cols-[72px_1fr] gap-3">
              <span className="tnum text-slate">{timeOfDay(e.at)}</span>
              <span className={cx(e.level === "error" ? "text-signal-orange" : e.level === "info" ? "text-pure-white" : "text-pure-white/70")}>{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
