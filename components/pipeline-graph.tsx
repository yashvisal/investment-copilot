"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eyebrow, cx } from "./ui";

export type GraphNode = {
  id: string;
  name: string;
  count: string;
  cost: string;
  time: string;
  what: string;
  output: string;
};

type Pos = { x: number; y: number };

const NODE_W = 150;
const NODE_H = 84;
const HEIGHT = 340;

/** Default layout: a gentle arc across the canvas so the graph reads left to right. */
function defaultPositions(n: number, width: number): Pos[] {
  const pad = 24;
  const usable = Math.max(width - pad * 2 - NODE_W, 1);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const x = pad + t * usable;
    const y = 40 + Math.sin(t * Math.PI) * 120 + (i % 2 === 0 ? 0 : 36);
    return { x, y };
  });
}

/**
 * Draggable node graph. Each stage is a node; edges connect consecutive
 * stages. Drag to rearrange, click a node to read about it.
 */
export function PipelineGraph({ nodes }: { nodes: GraphNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState<Pos[]>([]);
  const [selected, setSelected] = useState(0);
  const drag = useRef<{ i: number; dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setWidth(w);
      setPos((p) => (p.length === nodes.length ? p : defaultPositions(nodes.length, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [nodes.length]);

  function clamp(p: Pos): Pos {
    return {
      x: Math.min(Math.max(p.x, 0), Math.max(width - NODE_W, 0)),
      y: Math.min(Math.max(p.y, 0), HEIGHT - NODE_H),
    };
  }

  function onPointerDown(i: number, e: ReactPointerEvent<HTMLButtonElement>) {
    const p = pos[i];
    drag.current = { i, dx: e.clientX - p.x, dy: e.clientY - p.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const next = clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    d.moved = d.moved || Math.abs(next.x - pos[d.i].x) > 2 || Math.abs(next.y - pos[d.i].y) > 2;
    setPos((p) => p.map((q, j) => (j === d.i ? next : q)));
  }
  function onPointerUp(i: number) {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setSelected(i);
  }

  const s = nodes[selected];

  return (
    <div>
      <div
        ref={ref}
        className="relative w-full select-none overflow-hidden rounded-sm border border-hairline bg-pure-white"
        style={{ height: HEIGHT, backgroundImage: "radial-gradient(var(--color-hairline) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {pos.length === nodes.length &&
            pos.slice(0, -1).map((a, i) => {
              const b = pos[i + 1];
              const ax = a.x + NODE_W;
              const ay = a.y + NODE_H / 2;
              const bx = b.x;
              const by = b.y + NODE_H / 2;
              const mx = (ax + bx) / 2;
              const active = i === selected || i + 1 === selected;
              return (
                <path
                  key={i}
                  d={`M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`}
                  fill="none"
                  stroke={active ? "var(--color-ink-black)" : "var(--color-concrete)"}
                  strokeWidth={1}
                />
              );
            })}
        </svg>
        {pos.length === nodes.length &&
          nodes.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onPointerDown={(e) => onPointerDown(i, e)}
              onPointerMove={onPointerMove}
              onPointerUp={() => onPointerUp(i)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(i);
                }
              }}
              aria-pressed={selected === i}
              className={cx(
                "absolute cursor-grab touch-none rounded-sm border bg-pure-white p-3 text-left shadow-sm transition-colors active:cursor-grabbing",
                selected === i ? "border-ink-black" : "border-hairline hover:border-concrete",
              )}
              style={{ left: pos[i].x, top: pos[i].y, width: NODE_W, height: NODE_H }}
            >
              <div className="flex items-center gap-2">
                <span className={cx("block h-2 w-2 rounded-full", selected === i ? "bg-signal-orange" : "bg-ink-black")} />
                <span className="t-mono-up text-ink-black">{n.name}</span>
              </div>
              <div className="t-title tnum mt-2 text-ink-black">{n.count}</div>
              <div className="t-mono tnum text-slate">{n.cost}</div>
            </button>
          ))}
        <div className="t-mono pointer-events-none absolute bottom-3 right-3 text-slate">drag to rearrange · click to read</div>
      </div>

      {s && (
        <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 border-t border-hairline pt-6 md:grid-cols-[1fr_260px]">
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
