"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { usd } from "@/lib/format";
import {
  DEFAULT_DILIGENCE_LIMIT,
  DEFAULT_SCREEN_LIMIT,
  MATCH_LIMIT_OPTIONS,
  estimateRun,
  type MatchLimit,
} from "@/lib/parallel/cost";
import { DEFAULT_OBJECTIVE_HINT, DEFAULT_THESIS } from "@/lib/parallel/specs";
import type { MatchCondition } from "@/lib/parallel/types";
import { Button, Meta, cx } from "./ui";

type Block = { reason: "budget" | "disabled" | "busy"; message: string; contact: string };

export function ThesisComposer() {
  const router = useRouter();
  const ingest = useAction(api.pipeline.ingestThesis);
  const start = useMutation(api.runs.start);
  const budget = useQuery(api.budget.get);
  const canonical = useQuery(api.runs.canonical);

  const [thesis, setThesis] = useState(DEFAULT_THESIS);
  const [objective, setObjective] = useState(`${DEFAULT_THESIS} ${DEFAULT_OBJECTIVE_HINT}`);
  const [matchLimit, setMatchLimit] = useState<MatchLimit>(10);
  const [conditions, setConditions] = useState<MatchCondition[] | null>(null);
  const [entityType, setEntityType] = useState("companies");
  const [deriving, setDeriving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState<Block | null>(null);

  const estimate = useMemo(
    () => estimateRun({ matchLimit, screenLimit: DEFAULT_SCREEN_LIMIT, diligenceLimit: DEFAULT_DILIGENCE_LIMIT }),
    [matchLimit],
  );
  const screenN = Math.min(DEFAULT_SCREEN_LIMIT, matchLimit);

  async function derive() {
    setDeriving(true);
    setError(null);
    try {
      const schema = await ingest({ objective });
      setConditions(schema.matchConditions);
      setEntityType(schema.entityType);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeriving(false);
    }
  }

  async function run() {
    if (!conditions) return;
    setStarting(true);
    setError(null);
    try {
      const res = await start({ thesis, objective, entityType, matchConditions: conditions, matchLimit });
      if (res.ok) router.push(`/runs/${res.runId}`);
      else setBlock({ reason: res.reason, message: res.message, contact: res.contact });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <textarea
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        rows={3}
        aria-label="Investment thesis"
        className="w-full resize-none overflow-hidden border-0 border-b border-hairline bg-transparent px-0 py-2 text-heading-sm leading-[1.23] text-ink-black outline-none focus:border-ink-black"
      />

      <details className="mt-6 group">
        <summary className="cursor-pointer list-none font-mono text-ui text-slate hover:text-ink-black">
          <span className="group-open:hidden">Refine what FindAll searches for</span>
          <span className="hidden group-open:inline">Discovery objective</span>
        </summary>
        <textarea
          value={objective}
          onChange={(e) => {
            setObjective(e.target.value);
            setConditions(null);
          }}
          rows={5}
          className="mt-3 w-full resize-y rounded-sm border border-hairline bg-pure-white px-3 py-2 text-body text-ink-black outline-none focus:border-ink-black"
        />
      </details>

      <div className="mt-8 flex items-center gap-4">
        <Button variant="dark" onClick={derive} disabled={deriving || !objective.trim()}>
          {deriving ? "Deriving…" : conditions ? "Re-derive conditions" : "Derive match conditions"}
        </Button>
        {!conditions && <span className="text-small text-slate">Free. Parallel turns the thesis into checkable conditions.</span>}
      </div>

      {conditions && (
        <section className="mt-10">
          <p className="text-base text-ink-black">Every discovered company must satisfy all of these. Edit to loosen or tighten.</p>
          <ol className="mt-4 space-y-3">
            {conditions.map((c, i) => (
              <li key={c.name} className="flex gap-4">
                <span className="tnum w-5 shrink-0 pt-0.5 font-mono text-ui text-slate">{i + 1}</span>
                <textarea
                  value={c.description}
                  rows={2}
                  onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className="min-w-0 flex-1 resize-none bg-transparent text-body leading-[1.5] text-ink-black outline-none"
                />
                <button
                  className="self-start font-mono text-ui text-slate hover:text-status-red"
                  onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                  aria-label="Remove condition"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-12 border-t border-hairline pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-small text-slate">Discover</span>
            <div className="flex gap-1">
              {MATCH_LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setMatchLimit(n)}
                  className={cx(
                    "tnum rounded-sm px-2.5 py-1 font-mono text-ui transition-colors",
                    matchLimit === n ? "bg-ink-black text-cream-paper" : "text-graphite hover:bg-fog",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-small text-slate">companies</span>
          </div>
          <Button variant="orange" onClick={run} disabled={!conditions || starting || conditions.length === 0}>
            {starting ? "Starting…" : `Run for ${usd(estimate.totalUsd)}`}
          </Button>
        </div>
        <p className="mt-4 max-w-[620px] text-body leading-[1.6] text-graphite">
          FindAll discovers up to {matchLimit} matches on the core generator, then our code ranks them on FindAll&apos;s own evidence and sends the top {screenN} to a core screening task. At most {DEFAULT_DILIGENCE_LIMIT} finalists get a pro diligence brief. Expect about 25 minutes end to end.
        </p>
        <Meta className="mt-3 tnum">
          {estimate.stages.map((s) => `${s.stage} ${usd(s.costUsd)}`).join(" · ")}
          {budget && ` · ${usd(budget.remainingUsd)} left in the project budget`}
        </Meta>
        {error && <p className="mt-4 text-small text-status-red">{error}</p>}
        {canonical && (
          <p className="mt-6 text-small text-slate">
            Or read the{" "}
            <Link href={`/runs/${canonical._id}`} className="text-schematic-blue hover:underline">
              latest completed run
            </Link>{" "}
            without spending anything.
          </p>
        )}
      </section>

      {block && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-black/40 p-6" onClick={() => setBlock(null)}>
          <div className="w-full max-w-md rounded-sm border border-hairline bg-cream-paper p-6 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-base text-ink-black">{block.message}</p>
            {block.reason === "budget" && (
              <p className="mt-3 text-body text-graphite">
                If you would like to test this out, email{" "}
                <a className="text-schematic-blue" href={`mailto:${block.contact}`}>
                  {block.contact}
                </a>{" "}
                and the allocation can be topped up.
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="dark" onClick={() => setBlock(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
