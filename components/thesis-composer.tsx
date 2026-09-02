"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { usd } from "@/lib/format";
import { DEFAULT_DILIGENCE_LIMIT, DEFAULT_SCREEN_LIMIT, MATCH_LIMIT_OPTIONS, estimateRun, type MatchLimit } from "@/lib/parallel/cost";
import { DEFAULT_OBJECTIVE_HINT, DEFAULT_THESIS } from "@/lib/parallel/specs";
import type { MatchCondition } from "@/lib/parallel/types";
import { Button, Eyebrow, Meta, Wire, cx } from "./ui";

type Block = { reason: "budget" | "disabled" | "busy"; message: string; contact: string };

export function ThesisComposer() {
  const router = useRouter();
  const ingest = useAction(api.pipeline.ingestThesis);
  const start = useMutation(api.runs.start);
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
  const byStage = Object.fromEntries(estimate.stages.map((s) => [s.stage, s.costUsd]));

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
      <Eyebrow>Thesis</Eyebrow>
      <textarea
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        rows={3}
        aria-label="Investment thesis"
        className="t-title mt-3 w-full resize-none overflow-hidden border-0 border-b border-hairline bg-transparent px-0 pb-4 text-ink-black outline-none focus:border-ink-black"
      />

      <details className="group mt-4">
        <summary className="t-mono cursor-pointer list-none text-slate hover:text-ink-black">
          <span className="group-open:hidden">Refine what discovery searches for</span>
          <span className="hidden group-open:inline">Discovery objective</span>
        </summary>
        <textarea
          value={objective}
          onChange={(e) => {
            setObjective(e.target.value);
            setConditions(null);
          }}
          rows={5}
          className="t-body mt-3 w-full resize-y rounded-sm border border-hairline bg-pure-white px-3 py-2 text-ink-black outline-none focus:border-ink-black"
        />
      </details>

      <div className="mt-8 flex items-center gap-4">
        <Button variant="dark" onClick={derive} disabled={deriving || !objective.trim()}>
          {deriving ? "Deriving…" : conditions ? "Re-derive conditions" : "Derive match conditions"}
        </Button>
        {!conditions && <span className="t-small text-slate">Free. Turns the thesis into checkable conditions.</span>}
      </div>

      {conditions && (
        <section className="mt-12">
          <Eyebrow>Match conditions</Eyebrow>
          <p className="t-body mt-3 text-graphite">Every discovered company must satisfy all of these. Edit to loosen or tighten.</p>
          <ol className="mt-5 divide-y divide-hairline border-y border-hairline">
            {conditions.map((c, i) => (
              <li key={c.name} className="flex gap-5 py-4">
                <span className="t-mono tnum w-4 shrink-0 pt-0.5 text-slate">{i + 1}</span>
                <textarea
                  value={c.description}
                  rows={2}
                  onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className="t-body min-w-0 flex-1 resize-none bg-transparent text-ink-black outline-none"
                />
                <button
                  className="t-mono self-start text-slate hover:text-status-red"
                  onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                  aria-label="Remove condition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-12">
        <Eyebrow>Run plan</Eyebrow>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="t-small text-graphite">Discover</span>
            <div className="flex gap-1">
              {MATCH_LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setMatchLimit(n)}
                  className={cx(
                    "t-mono tnum h-8 rounded-sm px-3 transition-colors",
                    matchLimit === n ? "bg-ink-black text-pure-white" : "text-graphite hover:bg-fog",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="t-small text-graphite">companies</span>
          </div>
          <Button variant="orange" onClick={run} disabled={!conditions || starting || conditions.length === 0}>
            {starting ? "Starting…" : `Run for ${usd(estimate.totalUsd)}`}
          </Button>
        </div>

        <Wire
          className="mt-8"
          nodes={[
            { label: "Discover", state: "pending", value: `${matchLimit} · ${usd(byStage.discover)}` },
            { label: "Prioritize", state: "pending", value: `${screenN} · $0` },
            { label: "Screen", state: "pending", value: `${screenN} · ${usd(byStage.screen)}` },
            { label: "Diligence", state: "pending", value: `${DEFAULT_DILIGENCE_LIMIT} · ${usd(byStage.diligence)}` },
            { label: "Decide", state: "pending", value: "you" },
          ]}
        />
        <p className="t-small mt-6 max-w-[560px] text-graphite">About 25 minutes end to end. The strongest research runs only on the finalists.</p>
        {error && <p className="t-small mt-4 text-status-red">{error}</p>}
        {canonical && (
          <Meta className="mt-6">
            Or read the{" "}
            <Link href={`/runs/${canonical._id}`} className="text-schematic-blue hover:underline">
              latest completed run
            </Link>{" "}
            without spending anything.
          </Meta>
        )}
      </section>

      {block && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-black/40 p-6" onClick={() => setBlock(null)}>
          <div className="w-full max-w-md rounded-sm border border-hairline bg-pure-white p-6 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <p className="t-body text-ink-black">{block.message}</p>
            {block.reason === "budget" && (
              <p className="t-body mt-3 text-graphite">
                To test this out, email{" "}
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
