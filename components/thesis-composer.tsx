"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { usd, minutesRange } from "@/lib/format";
import {
  DEFAULT_DILIGENCE_LIMIT,
  DEFAULT_SCREEN_LIMIT,
  MATCH_LIMIT_OPTIONS,
  estimateRun,
  type MatchLimit,
} from "@/lib/parallel/cost";
import { DEFAULT_OBJECTIVE_HINT, DEFAULT_THESIS } from "@/lib/parallel/specs";
import type { MatchCondition } from "@/lib/parallel/types";
import { Button, Card, SectionLabel, Tag, cx } from "./ui";

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
  const overBudget = budget ? estimate.totalUsd > budget.remainingUsd : false;

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
      if (res.ok) {
        router.push(`/runs/${res.runId}`);
      } else {
        setBlock({ reason: res.reason, message: res.message, contact: res.contact });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-12">
      <div className="col-span-12 lg:col-span-7">
        <SectionLabel>Investment thesis</SectionLabel>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={4}
          className="mt-3 w-full resize-none overflow-hidden border-0 border-b border-hairline bg-transparent px-0 py-2 font-serif text-heading-sm leading-[1.23] text-ink-black outline-none placeholder:text-concrete focus:border-ink-black"
        />

        <div className="mt-8">
          <SectionLabel>Discovery objective</SectionLabel>
          <p className="mt-2 text-small text-slate">
            What FindAll searches for. Be explicit about stage, founding year, and evidence. The thesis above is what screening and diligence evaluate against.
          </p>
          <textarea
            value={objective}
            onChange={(e) => {
              setObjective(e.target.value);
              setConditions(null);
            }}
            rows={6}
            className="mt-3 w-full resize-y rounded-sm border border-hairline bg-pure-white px-3 py-2 font-serif text-body text-ink-black outline-none focus:border-ink-black"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button variant="dark" onClick={derive} disabled={deriving || !objective.trim()}>
              {deriving ? "Deriving…" : conditions ? "Re-derive conditions" : "Derive match conditions"}
            </Button>
            <span className="text-small text-slate">Free. Uses FindAll ingest to turn the objective into checkable conditions.</span>
          </div>
        </div>

        {conditions && (
          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Match conditions</SectionLabel>
              <span className="chrome text-caption text-slate">{entityType}</span>
            </div>
            <p className="mt-2 text-small text-slate">
              Every candidate must satisfy all of these. Edit wording to loosen or tighten the funnel.
            </p>
            <ol className="mt-3 divide-y divide-hairline border-t border-hairline">
              {conditions.map((c, i) => (
                <li key={c.name} className="flex gap-4 py-3">
                  <span className="chrome tnum w-6 shrink-0 pt-1 text-caption text-slate">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="chrome text-caption text-graphite">{c.name.replace(/_/g, " ")}</div>
                    <textarea
                      value={c.description}
                      rows={2}
                      onChange={(e) =>
                        setConditions(conditions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                      }
                      className="mt-1 w-full resize-none bg-transparent font-serif text-body text-ink-black outline-none"
                    />
                  </div>
                  <button
                    className="chrome self-start pt-1 text-caption text-slate hover:text-status-red"
                    onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                    aria-label="Remove condition"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && <p className="mt-6 text-small text-status-red">{error}</p>}
      </div>

      <aside className="col-span-12 lg:col-span-5">
        <Card className="p-6">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Run plan</SectionLabel>
            <span className="chrome text-caption text-slate">Estimate before you spend</span>
          </div>

          <label className="mt-5 block">
            <span className="chrome text-caption text-graphite">Companies to discover</span>
            <div className="mt-2 flex gap-2">
              {MATCH_LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setMatchLimit(n)}
                  className={cx(
                    "chrome tnum flex-1 rounded-sm border px-3 py-2 text-label transition-colors",
                    matchLimit === n ? "border-ink-black bg-ink-black text-cream-paper" : "border-hairline text-ink-black hover:bg-fog",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>

          <table className="mt-6 w-full text-small">
            <thead>
              <tr className="chrome text-caption text-slate">
                <th className="pb-2 text-left font-medium">Stage</th>
                <th className="pb-2 text-left font-medium">Primitive</th>
                <th className="pb-2 text-right font-medium">Units</th>
                <th className="pb-2 text-right font-medium">Time</th>
                <th className="pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline border-t border-hairline">
              {estimate.stages.map((s) => (
                <Fragment key={s.stage}>
                <tr>
                  <td className="py-2 capitalize">{s.stage}</td>
                  <td className="py-2 text-graphite">
                    {s.primitive} <span className="chrome text-caption text-slate">{s.processor}</span>
                  </td>
                  <td className="tnum py-2 text-right">{s.units}</td>
                  <td className="tnum py-2 text-right text-graphite">{minutesRange(s.expectedMinutes)}</td>
                  <td className="tnum py-2 text-right">{usd(s.costUsd)}</td>
                </tr>
                {s.stage === "discover" && (
              <tr>
                <td className="py-2 text-graphite">Prioritize</td>
                <td className="py-2 text-graphite">
                  Our code <span className="chrome text-caption text-slate">FindAll evidence only</span>
                </td>
                <td className="tnum py-2 text-right">{Math.min(DEFAULT_SCREEN_LIMIT, matchLimit)}</td>
                <td className="tnum py-2 text-right text-graphite">instant</td>
                <td className="tnum py-2 text-right">$0.00</td>
              </tr>
                )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-black">
                <td className="pt-3 font-medium" colSpan={4}>
                  Estimated total
                </td>
                <td className="tnum pt-3 text-right font-medium">{usd(estimate.totalUsd)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-4 text-small text-slate">
            Spend rises with conviction: {matchLimit} discovered on FindAll core, the top {Math.min(DEFAULT_SCREEN_LIMIT, matchLimit)} screened on core, and at most {DEFAULT_DILIGENCE_LIMIT} diligenced on pro. Follow-up questions cost a cent each.
          </p>

          <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
            <div className="chrome text-caption text-slate">
              Budget remaining{" "}
              <span className={cx("tnum", overBudget ? "text-status-red" : "text-ink-black")}>
                {budget ? usd(budget.remainingUsd) : "…"}
              </span>
            </div>
            <Button variant="orange" onClick={run} disabled={!conditions || starting || conditions.length === 0}>
              {starting ? "Starting…" : "Run research"}
            </Button>
          </div>
          {!conditions && <p className="mt-3 text-caption text-slate">Derive match conditions first.</p>}
        </Card>

        {canonical && (
          <p className="mt-6 text-small text-slate">
            Or read the{" "}
            <Link href={`/runs/${canonical._id}`} className="text-schematic-blue underline-offset-2 hover:underline">
              latest completed run
            </Link>{" "}
            without spending anything.
          </p>
        )}
      </aside>

      {block && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-black/40 p-6" onClick={() => setBlock(null)}>
          <Card className="w-full max-w-md bg-cream-paper p-6 shadow-sm" >
            <Tag tone={block.reason === "budget" ? "red" : "amber"}>
              {block.reason === "budget" ? "Budget exhausted" : block.reason === "busy" ? "Run in progress" : "Live runs disabled"}
            </Tag>
            <p className="mt-4 font-serif text-base text-ink-black">{block.message}</p>
            {block.reason === "budget" && (
              <p className="mt-3 text-body text-graphite">
                If you would like to test this out, email or message Yash Visal at{" "}
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
          </Card>
        </div>
      )}
    </div>
  );
}
