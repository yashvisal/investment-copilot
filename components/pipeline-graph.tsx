"use client";

import { Fragment, useState } from "react";
import { Eyebrow, Meta, cx } from "./ui";

export type GraphNode = {
  id: string;
  name: string;
  count: string;
  cost: string;
  time: string;
  what: string;
  output: string;
};

/**
 * The pipeline as a straight row of stages joined by arrows.
 * Click a stage to read about it below.
 */
export function PipelineGraph({ nodes }: { nodes: GraphNode[] }) {
  const [selected, setSelected] = useState(0);
  const s = nodes[selected];

  return (
    <div>
      <div
        className="flex items-center overflow-x-auto rounded-sm border border-hairline bg-pure-white px-10 py-16"
        style={{ backgroundImage: "radial-gradient(var(--color-hairline) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      >
        {nodes.map((n, i) => {
          const on = selected === i;
          return (
            <Fragment key={n.id}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={on}
                className={cx(
                  "w-[140px] shrink-0 cursor-pointer rounded-sm border bg-pure-white p-3 text-left shadow-sm transition-colors",
                  on ? "border-ink-black" : "border-hairline hover:border-concrete",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cx("block h-2 w-2 rounded-full", on ? "bg-signal-orange" : "bg-ink-black")} />
                  <span className="t-mono-up text-ink-black">{n.name}</span>
                </div>
                <div className="t-title tnum mt-2 text-ink-black">{n.count}</div>
                <div className="t-mono tnum text-slate">{n.cost}</div>
              </button>
              {i < nodes.length - 1 && <Arrow active={i === selected || i + 1 === selected} />}
            </Fragment>
          );
        })}
      </div>
      <Meta className="mt-3">Select a stage to read about it.</Meta>

      {s && (
        <div className="mt-16 grid grid-cols-1 gap-x-12 gap-y-4 border-t border-hairline pt-10 md:grid-cols-[1fr_260px]">
          <div>
            <h2 className="t-title text-ink-black">{s.name}</h2>
            <p className="t-body mt-3 max-w-[600px] text-graphite">{s.what}</p>
          </div>
          <dl className="t-mono space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate">Scope</dt>
              <dd className="tnum text-ink-black">{s.count}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate">Cost</dt>
              <dd className="tnum text-ink-black">{s.cost}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate">Time</dt>
              <dd className="tnum text-ink-black">{s.time}</dd>
            </div>
            <div className="mt-3 border-t border-hairline pt-3">
              <Eyebrow>Produces</Eyebrow>
              <div className="t-small mt-1 text-ink-black">{s.output}</div>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function Arrow({ active }: { active: boolean }) {
  const color = active ? "var(--color-ink-black)" : "var(--color-concrete)";
  return (
    <span className="flex min-w-[24px] flex-1 items-center" aria-hidden="true">
      <span className="h-px flex-1" style={{ background: color }} />
      <svg width="7" height="9" viewBox="0 0 7 9" className="shrink-0">
        <path d="M0 0 L7 4.5 L0 9 Z" fill={color} />
      </svg>
    </span>
  );
}
