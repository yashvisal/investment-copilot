"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { elapsed, hostname, minutesRange, timeOfDay, usd } from "@/lib/format";
import { STAGE_CONFIG } from "@/lib/parallel/cost";
import { CLASSIFICATION_ORDER } from "@/lib/parallel/classify";
import { ClassTag, DecisionTag, Dot, Empty, Page, SectionLabel, Tag, cx } from "./ui";
import { Nav } from "./nav";

type Stage = "discover" | "prioritize" | "screen" | "diligence";

const STAGES: Array<{ key: Stage; label: string; primitive: string; processor: string; expected?: readonly [number, number] }> = [
  { key: "discover", label: "Discover", primitive: "FindAll", processor: STAGE_CONFIG.discover.generator, expected: STAGE_CONFIG.discover.expectedMinutes },
  { key: "prioritize", label: "Prioritize", primitive: "Our code", processor: "no API" },
  { key: "screen", label: "Screen", primitive: "Task Group", processor: STAGE_CONFIG.screen.processor, expected: STAGE_CONFIG.screen.expectedMinutes },
  { key: "diligence", label: "Diligence", primitive: "Task", processor: STAGE_CONFIG.diligence.processor, expected: STAGE_CONFIG.diligence.expectedMinutes },
];

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

  if (run === undefined) {
    return (
      <>
        <Nav />
        <Page>
          <p className="mt-12 text-small text-slate">Loading run…</p>
        </Page>
      </>
    );
  }
  if (run === null) {
    return (
      <>
        <Nav />
        <Page>
          <Empty>Run not found.</Empty>
        </Page>
      </>
    );
  }

  const matched = (companies ?? []).filter((c) => c.matchStatus === "matched");
  const unmatched = (companies ?? []).filter((c) => c.matchStatus !== "matched");
  const screened = matched.filter((c) => c.screen?.status === "completed");
  const diligenced = matched.filter((c) => c.diligence?.status === "completed");
  const watchlist = matched.filter((c) => c.decision === "watch" || c.decision === "deep_diligence");

  return (
    <>
      <Nav />
      <Page>
        <div className="mt-10 flex items-start justify-between gap-8">
          <div className="max-w-[760px]">
            <SectionLabel>Thesis</SectionLabel>
            <h1 className="mt-2 font-serif text-heading-sm font-medium leading-[1.23] text-ink-black">{run.thesis}</h1>
          </div>
          <div className="shrink-0 text-right">
            <StatusTag status={run.status} />
            <div className="chrome tnum mt-2 text-caption text-slate">
              spent {usd(run.spendUsd)} of est. {usd(run.estimatedCostUsd)}
            </div>
          </div>
        </div>

        <PipelineRail run={run} now={now} />

        <div className="mt-10 grid grid-cols-12 gap-10">
          <div className="col-span-12 xl:col-span-8">
            <Funnel
              discovered={matched.length}
              prioritized={matched.filter((c) => c.priorityRank !== undefined).length}
              screened={screened.length}
              diligenced={diligenced.length}
              watchlist={watchlist.length}
            />
            {run.error && (
              <div className="mt-6 border border-status-red/30 px-4 py-3 text-small text-status-red">{run.error}</div>
            )}
            <CompanyTable runId={run._id} companies={matched} status={run.status} />
            {unmatched.length > 0 && (
              <details className="mt-6">
                <summary className="chrome cursor-pointer text-caption text-slate">
                  {unmatched.length} candidates evaluated and not matched
                </summary>
                <ul className="mt-3 divide-y divide-hairline border-t border-hairline text-small text-graphite">
                  {unmatched.map((c) => (
                    <li key={c._id} className="flex items-center justify-between py-2">
                      <span>
                        {c.name} <span className="text-slate">{hostname(c.url)}</span>
                      </span>
                      <span className="chrome text-caption text-slate">{c.matchStatus}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <div className="col-span-12 xl:col-span-4">
            <EventLog events={events ?? []} active={active} />
          </div>
        </div>
      </Page>
    </>
  );
}

function StatusTag({ status }: { status: Doc<"runs">["status"] }) {
  const tone = status === "complete" ? "green" : status === "failed" ? "red" : "blue";
  const label = status === "complete" ? "Complete" : status === "failed" ? "Failed" : status;
  return <Tag tone={tone}>{label}</Tag>;
}

function PipelineRail({ run, now }: { run: Doc<"runs">; now: number }) {
  const activeKey: Stage | null =
    run.status === "discovering" ? "discover" : run.status === "prioritizing" ? "prioritize" : run.status === "screening" ? "screen" : run.status === "diligencing" ? "diligence" : null;

  return (
    <div className="mt-8 grid grid-cols-4 gap-12 border-t border-hairline">
      {STAGES.map((s, i) => {
        const stats = run.stages[s.key];
        const isActive = activeKey === s.key;
        const isDone = !!stats.completedAt;
        const isPending = !stats.startedAt;
        return (
          <div key={s.key} className={cx("pt-4", isPending && "opacity-50")}>
            <div className="flex items-center gap-2">
              <span className="chrome tnum text-caption text-slate">{String(i + 1).padStart(2, "0")}</span>
              <span className="chrome text-body text-ink-black">{s.label}</span>
              <span className="ml-auto">
                {isActive ? <Dot tone="orange" pulse /> : isDone ? <Dot tone="green" /> : <Dot tone="slate" />}
              </span>
            </div>
            <div className="mt-2 text-small text-slate">
              {s.primitive} <span className="chrome text-caption">{s.processor}</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="tnum font-serif text-heading-sm font-medium leading-none text-ink-black">{stats.count ?? 0}</span>
              <span className="text-small text-slate">{s.key === "discover" ? "matched" : s.key === "prioritize" ? "selected" : "complete"}</span>
            </div>
            <div className="chrome tnum mt-3 flex justify-between text-caption text-graphite">
              <span>
                {stats.startedAt ? elapsed(stats.startedAt, stats.completedAt, now) : s.expected ? `~${minutesRange(s.expected)}` : ""}
                {isActive && s.expected && <span className="text-slate"> / {minutesRange(s.expected)}</span>}
              </span>
              <span>{usd(stats.spendUsd ?? 0)}</span>
            </div>
            {stats.note && !isActive && <div className="chrome mt-1 text-caption text-slate">{stats.note.replace(/_/g, " ")}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Funnel(props: { discovered: number; prioritized: number; screened: number; diligenced: number; watchlist: number }) {
  const parts = [
    [props.discovered, "discovered"],
    [props.prioritized, "prioritized"],
    [props.screened, "screened"],
    [props.diligenced, "diligenced"],
    [props.watchlist, "watchlist"],
  ] as const;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-serif text-heading-sm leading-[1.23] text-ink-black">
      {parts.map(([n, label], i) => (
        <span key={label} className="flex items-baseline gap-2">
          <span className="tnum font-medium text-schematic-blue">{n}</span>
          <span className="text-graphite">{label}</span>
          {i < parts.length - 1 && <span className="mx-1 text-concrete">→</span>}
        </span>
      ))}
    </div>
  );
}

function CompanyTable({ runId, companies, status }: { runId: Id<"runs">; companies: Doc<"companies">[]; status: Doc<"runs">["status"] }) {
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
    return (
      <div className="mt-8">
        <Empty>{status === "discovering" ? "FindAll is evaluating candidates. Matches appear here as they are confirmed." : "No matched companies."}</Empty>
      </div>
    );
  }

  return (
    <table className="mt-8 w-full border-t border-hairline text-small">
      <thead>
        <tr className="chrome text-caption text-slate">
          <th className="py-3 text-left font-medium">Company</th>
          <th className="py-3 text-left font-medium">Stage</th>
          <th className="py-3 text-left font-medium">Why it is interesting</th>
          <th className="py-3 text-right font-medium">Decision</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline border-t border-hairline">
        {rows.map((c) => (
          <tr key={c._id} className="group align-top hover:bg-fog/50">
            <td className="w-[220px] py-3 pr-4">
              <Link href={`/runs/${runId}/companies/${c._id}`} className="font-serif text-base text-ink-black underline-offset-2 group-hover:underline">
                {c.name}
              </Link>
              <div className="chrome mt-0.5 text-caption text-slate">{hostname(c.url)}</div>
              {c.priorityRank !== undefined && (
                <div className="chrome tnum mt-1 text-caption text-slate">priority #{c.priorityRank}</div>
              )}
            </td>
            <td className="w-[150px] py-3 pr-4">
              <StageCell c={c} />
            </td>
            <td className="py-3 pr-4 text-body text-graphite">
              <WhyCell c={c} />
            </td>
            <td className="w-[120px] py-3 text-right">
              <DecisionTag decision={c.decision} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StageCell({ c }: { c: Doc<"companies"> }) {
  if (c.diligence?.status === "completed") return <Tag tone="ink">Diligenced</Tag>;
  if (c.diligence && (c.diligence.status === "queued" || c.diligence.status === "running"))
    return (
      <span className="inline-flex items-center gap-2">
        <Dot tone="orange" pulse /> <span className="chrome text-caption text-graphite">Diligence</span>
      </span>
    );
  if (c.screen?.status === "completed") return <ClassTag classification={c.screenClassification} />;
  if (c.screen && (c.screen.status === "queued" || c.screen.status === "running"))
    return (
      <span className="inline-flex items-center gap-2">
        <Dot tone="orange" pulse /> <span className="chrome text-caption text-graphite">Screening</span>
      </span>
    );
  if (c.priorityRank !== undefined) return <Tag tone="fog">Prioritized</Tag>;
  return <Tag tone="fog">Matched</Tag>;
}

function WhyCell({ c }: { c: Doc<"companies"> }) {
  const out = c.screen?.output as Record<string, unknown> | undefined;
  const sells = typeof out?.what_it_sells === "string" ? (out.what_it_sells as string) : null;
  const reason = c.screenReasons?.[0];
  if (sells || reason) {
    return (
      <div>
        {sells && <p className="line-clamp-2 text-ink-black">{sells}</p>}
        {reason && <p className="mt-1 text-small text-slate">{reason}</p>}
      </div>
    );
  }
  if (c.priorityReasons?.length) return <p className="text-small text-slate">{c.priorityReasons.join(" · ")}</p>;
  if (c.description) return <p className="line-clamp-2">{c.description}</p>;
  return <span className="text-slate">—</span>;
}

function EventLog({ events, active }: { events: Doc<"events">[]; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [events.length]);
  return (
    <div className="sticky top-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Pipeline log</SectionLabel>
        <span className="flex items-center gap-2">
          <Dot tone={active ? "orange" : "green"} pulse={active} />
          <span className="chrome text-caption text-slate">{active ? "live" : "finished"}</span>
        </span>
      </div>
      <div ref={ref} className="mt-3 h-[520px] overflow-y-auto bg-ink-black p-4 font-mono text-ui text-cream-paper/80">
        {events.length === 0 && <div className="text-slate">waiting for events…</div>}
        {events.map((e) => (
          <div key={e._id} className="mb-2 grid grid-cols-[64px_72px_1fr] gap-2 leading-[1.5]">
            <span className="tnum text-slate">{timeOfDay(e.at)}</span>
            <span className={cx("uppercase", e.level === "error" ? "text-signal-orange" : e.level === "warn" ? "text-status-amber" : "text-slate")}>{e.stage}</span>
            <span className={cx(e.level === "info" ? "text-cream-paper" : e.level === "error" ? "text-signal-orange" : "text-cream-paper/70")}>{e.message}</span>
          </div>
        ))}
        {active && <div className="mt-2 animate-pulse text-slate">▌</div>}
      </div>
    </div>
  );
}
