"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { elapsed, hostname, timeOfDay, usd } from "@/lib/format";
import { CLASSIFICATION_ORDER } from "@/lib/parallel/classify";
import { CLASS_LABEL, DECISION_LABEL, Empty, Meta, Page, Spinner, Wire, cx, type WireNode } from "./ui";
import { Nav } from "./nav";

type StageKey = "discover" | "prioritize" | "screen" | "diligence";
const STAGE_ORDER: StageKey[] = ["discover", "prioritize", "screen", "diligence"];
const STAGE_LABEL: Record<StageKey, string> = {
  discover: "Discovering",
  prioritize: "Prioritizing",
  screen: "Screening",
  diligence: "Diligence",
};

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

  if (run === undefined) return <Shell>Loading…</Shell>;
  if (run === null) return <Shell>Run not found.</Shell>;

  const matched = (companies ?? []).filter((c) => c.matchStatus === "matched");
  const unmatched = (companies ?? []).filter((c) => c.matchStatus !== "matched");

  return (
    <>
      <Nav />
      <Page>
        <h1 className="t-title text-ink-black">{run.thesis}</h1>
        <Progress run={run} now={now} matched={matched.length} />
        {run.error && <p className="t-small mt-6 text-status-red">{run.error}</p>}
        <CompanyList runId={run._id} companies={matched} status={run.status} />
        {unmatched.length > 0 && (
          <details className="mt-8">
            <summary className="t-mono cursor-pointer list-none text-slate hover:text-ink-black">
              {unmatched.length} more evaluated at discovery and not matched
            </summary>
            <ul className="mt-3 space-y-1.5">
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

function Progress({ run, now, matched }: { run: Doc<"runs">; now: number; matched: number }) {
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
  if (run.status === "complete") line = `Complete. ${s.discover.count ?? 0} discovered, ${s.screen.count ?? 0} screened, ${s.diligence.count ?? 0} diligenced. Your call on the finalists.`;
  else if (run.status === "failed") line = "The run stopped. See the log below.";
  else if (activeKey === "discover") line = `Discovering. ${matched} of ${run.matchLimit} matched, ${run.generatedCount ?? 0} candidates evaluated.`;
  else if (activeKey === "prioritize") line = "Ranking matches on their discovery evidence.";
  else if (activeKey === "screen") line = `Screening ${s.prioritize.count ?? 0} companies at once. ${stats?.count ?? 0} done.`;
  else if (activeKey === "diligence") line = `Deep briefs running for ${run.diligenceLimit} finalists at once. ${stats?.count ?? 0} done.`;
  else line = "Queued.";

  return (
    <div className="mt-10">
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

function CompanyList({ runId, companies, status }: { runId: Id<"runs">; companies: Doc<"companies">[]; status: Doc<"runs">["status"] }) {
  const rows = useMemo(
    () =>
      [...companies].sort((a, b) => {
        const da = a.diligence?.status === "completed" ? 0 : 1;
        const db = b.diligence?.status === "completed" ? 0 : 1;
        if (da !== db) return da - db;
        const ca = a.screenClassification ? CLASSIFICATION_ORDER[a.screenClassification] : 3;
        const cb = b.screenClassification ? CLASSIFICATION_ORDER[b.screenClassification] : 3;
        if (ca !== cb) return ca - cb;
        if ((b.screenStrength ?? 0) !== (a.screenStrength ?? 0)) return (b.screenStrength ?? 0) - (a.screenStrength ?? 0);
        return (a.priorityRank ?? 99) - (b.priorityRank ?? 99);
      }),
    [companies],
  );

  if (rows.length === 0) {
    return <Empty>{status === "discovering" ? "Matches appear here as discovery confirms them." : "No matched companies."}</Empty>;
  }

  return (
    <ol className="mt-12 divide-y divide-hairline border-y border-hairline">
      {rows.map((c) => (
        <li key={c._id}>
          <Link href={`/runs/${runId}/companies/${c._id}`} className="group block py-5">
            <div className="flex items-baseline justify-between gap-6">
              <span className="t-body font-medium text-ink-black group-hover:text-schematic-blue">{c.name}</span>
              <span className="t-mono shrink-0 text-slate">{statusWord(c)}</span>
            </div>
            <p className="t-small mt-1 max-w-[600px] text-graphite">{why(c)}</p>
            {c.decision && <Meta className="mt-1">Your call: {DECISION_LABEL[c.decision]}</Meta>}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function statusWord(c: Doc<"companies">): string {
  if (c.diligence?.status === "completed") return "Diligenced";
  if (c.diligence && (c.diligence.status === "queued" || c.diligence.status === "running")) return "Diligence running";
  if (c.screen?.status === "completed" && c.screenClassification) return CLASS_LABEL[c.screenClassification];
  if (c.screen && (c.screen.status === "queued" || c.screen.status === "running")) return "Screening";
  if (c.priorityRank !== undefined) return `Ranked ${c.priorityRank}`;
  return "Matched";
}

function why(c: Doc<"companies">): string {
  const dil = c.diligence?.output as Record<string, unknown> | undefined;
  if (typeof dil?.bull_case === "string") return firstSentences(dil.bull_case as string, 2);
  const out = c.screen?.output as Record<string, unknown> | undefined;
  if (c.screenClassification === "pass" && c.screenReasons?.[0]) return c.screenReasons[0];
  if (typeof out?.what_it_sells === "string") return firstSentences(out.what_it_sells as string, 2);
  if (c.description) return firstSentences(c.description, 2);
  return "";
}

function firstSentences(text: string, n: number): string {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!parts) return text;
  return parts.slice(0, n).join("").trim();
}

function EventLog({ events, active }: { events: Doc<"events">[]; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [events.length, open]);
  const last = events[events.length - 1];
  return (
    <div className="mt-10 border-t border-hairline pt-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-baseline justify-between gap-4 text-left">
        <span className="t-mono text-slate hover:text-ink-black">{open ? "Hide log" : "Log"}</span>
        {!open && last && (
          <span className="t-mono min-w-0 flex-1 truncate text-slate">
            {active && <Spinner />} {last.message}
          </span>
        )}
      </button>
      {open && (
        <div ref={ref} className="t-mono mt-3 max-h-[420px] overflow-y-auto bg-ink-black p-4 text-pure-white/80">
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
