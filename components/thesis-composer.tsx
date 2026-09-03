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
import { AutoTextarea, Button, Eyebrow, Meta, Wire, cx } from "./ui";

type Block = { reason: "budget" | "disabled" | "busy"; message: string; contact: string };

export function ThesisComposer() {
  const router = useRouter();
  const ingest = useAction(api.pipeline.ingestThesis);
  const start = useMutation(api.runs.start);
  const canonical = useQuery(api.runs.canonical);

  const [thesis, setThesis] = useState("");
  const [planned, setPlanned] = useState<string | null>(null);
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
  const objective = `${thesis.trim()} ${DEFAULT_OBJECTIVE_HINT}`;
  const stale = planned !== null && planned !== thesis.trim();

  async function plan() {
    if (!thesis.trim() || deriving) return;
    setDeriving(true);
    setError(null);
    try {
      const schema = await ingest({ objective });
      setConditions(schema.matchConditions);
      setEntityType(schema.entityType);
      setPlanned(thesis.trim());
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
      const res = await start({ thesis: thesis.trim(), objective, entityType, matchConditions: conditions, matchLimit });
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void plan();
        }}
        className="flex items-end gap-3 rounded-sm border border-hairline bg-pure-white p-3 shadow-sm focus-within:border-ink-black"
      >
        <AutoTextarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void plan();
            }
          }}
          rows={1}
          aria-label="Investment thesis"
          placeholder="Describe the companies you want to find"
          className="t-lead min-h-[36px] flex-1 bg-transparent px-2 py-1 text-ink-black outline-none placeholder:text-concrete"
        />
        <Button type="submit" variant="dark" disabled={deriving || !thesis.trim()} className="w-24 shrink-0 disabled:opacity-100">
          {deriving ? "Planning" : "Plan"}
        </Button>
      </form>
      <Meta className="mt-2 flex flex-wrap gap-x-3">
        <span>Free to plan. Nothing is spent until you run.</span>
        {!thesis.trim() && (
          <button type="button" className="text-ink-black hover:text-schematic-blue" onClick={() => setThesis(DEFAULT_THESIS)}>
            Try an example
          </button>
        )}
      </Meta>
      {error && <p className="t-small mt-3 text-status-red">{error}</p>}

      {conditions && planned && (
        <section className={cx("mt-12 transition-opacity", stale && "opacity-50")}>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <Eyebrow>Match conditions</Eyebrow>
            {stale && <Meta>Thesis changed. Plan again to refresh.</Meta>}
          </div>
          <ol className="mt-4 divide-y divide-hairline border-y border-hairline">
            {conditions.map((c, i) => (
              <li key={c.name} className="flex gap-5 py-3">
                <span className="t-mono tnum w-4 shrink-0 pt-0.5 text-slate">{i + 1}</span>
                <AutoTextarea
                  value={c.description}
                  rows={1}
                  onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className="t-body min-w-0 flex-1 bg-transparent text-ink-black outline-none"
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

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Eyebrow>Discover</Eyebrow>
              <div className="inline-flex rounded-sm border border-hairline p-0.5">
                {MATCH_LIMIT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setMatchLimit(n)}
                    className={cx(
                      "t-mono tnum h-7 rounded-[1px] px-3 transition-colors",
                      matchLimit === n ? "bg-ink-black text-pure-white" : "text-graphite hover:bg-fog",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="t-small text-graphite">companies</span>
            </div>
            <Button variant="orange" onClick={run} disabled={starting || stale || conditions.length === 0}>
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
          <p className="t-small mt-6 max-w-[560px] text-graphite">About 25 minutes end to end. The deepest research runs only on the finalists.</p>
        </section>
      )}

      {canonical && !conditions && (
        <Meta className="mt-10">
          Or read the{" "}
          <Link href={`/runs/${canonical._id}`} className="text-schematic-blue hover:underline">
            latest completed run
          </Link>{" "}
          without spending anything.
        </Meta>
      )}

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
