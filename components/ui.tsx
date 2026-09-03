"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Classification, Decision } from "@/lib/parallel/types";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "dark" | "orange" | "ghost";

export const buttonBase =
  "t-mono-up inline-flex h-9 items-center justify-center gap-2 rounded-sm px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const buttonVariants: Record<ButtonVariant, string> = {
  dark: "bg-ink-black text-pure-white hover:bg-graphite",
  orange: "bg-signal-orange text-pure-white hover:brightness-95",
  ghost: "border border-hairline bg-pure-white text-ink-black hover:bg-fog",
};

export function Button({ variant = "ghost", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "ghost", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

/** The one content container. Same width on every page. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-[1120px] px-8 pb-32 pt-16", className)}>{children}</main>;
}

export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("t-mono text-slate", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("t-mono-up text-slate", className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="t-body py-10 text-slate">{children}</p>;
}

export const CLASS_LABEL: Record<Classification, string> = {
  high_priority: "High priority",
  investigate: "Investigate",
  pass: "Pass",
};

export const DECISION_LABEL: Record<Decision, string> = {
  pass: "Pass",
  watch: "Watch",
  deep_diligence: "Deep diligence",
};

/** Pass is black, Watch is blue, Deep diligence is orange. Same everywhere. */
const DECISION_FILL: Record<Decision, string> = {
  pass: "bg-ink-black text-pure-white",
  watch: "bg-schematic-blue text-pure-white",
  deep_diligence: "bg-signal-orange text-pure-white",
};

/* ------------------------------------------------------------------ */
/* Skeletons: quiet grey bars in the shape of what is coming.           */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-sm bg-fog", className)} />;
}

/** A card-shaped placeholder matching a company row or a run card. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-sm border border-hairline bg-pure-white p-5">
      <Skeleton className="h-4 w-48" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cx("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-signal-orange align-middle" />;
}

/* ------------------------------------------------------------------ */
/* Decision control: the same three-way switch everywhere.             */
/* ------------------------------------------------------------------ */

export function DecisionControl({ company, size = "sm", showStatus = false }: { company: Doc<"companies">; size?: "sm" | "md"; showStatus?: boolean }) {
  const setDecision = useMutation(api.companies.setDecision);
  // Optimistic value, valid only while the server value it was based on is unchanged.
  const [local, setLocal] = useState<{ base: Decision | null; value: Decision | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const server = company.decision ?? null;
  const current = local && local.base === server ? local.value : server;

  async function choose(d: Decision) {
    const nextValue = current === d ? null : d;
    setLocal({ base: server, value: nextValue });
    setError(null);
    try {
      await setDecision({ companyId: company._id, decision: nextValue });
    } catch (e) {
      setLocal(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="inline-flex rounded-sm border border-hairline bg-pure-white p-0.5" role="group" aria-label="Your decision">
        {(["pass", "watch", "deep_diligence"] as Decision[]).map((d) => {
          const on = current === d;
          return (
            <button
              key={d}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void choose(d);
              }}
              className={cx(
                "t-mono-up rounded-[1px] transition-colors",
                size === "sm" ? "h-7 px-2.5" : "h-8 px-3",
                on ? DECISION_FILL[d] : "text-graphite hover:bg-fog",
              )}
              aria-pressed={on}
            >
              {DECISION_LABEL[d]}
            </button>
          );
        })}
      </div>
      {showStatus && (
        <Meta className="mt-2">{error ? <span className="text-status-red">{error}</span> : current ? `Marked ${DECISION_LABEL[current]}` : "Not marked yet"}</Meta>
      )}
      {!showStatus && error && <Meta className="mt-1 text-status-red">{error}</Meta>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The wire: the pipeline drawn as one line with nodes.                */
/* ------------------------------------------------------------------ */

export type WireNode = {
  label: string;
  state: "done" | "active" | "pending";
  value?: string;
};

export function Wire({ nodes, className }: { nodes: WireNode[]; className?: string }) {
  return (
    <div className={cx("flex items-start", className)} role="list" aria-label="Pipeline">
      {nodes.map((n, i) => (
        <div key={n.label} role="listitem" className={cx("flex min-w-0 items-start", i < nodes.length - 1 ? "flex-1" : "shrink-0")}>
          <div className="flex shrink-0 flex-col items-start">
            <span
              className={cx(
                "mt-[3px] block h-2.5 w-2.5 rounded-full border-2",
                n.state === "done" && "border-ink-black bg-ink-black",
                n.state === "active" && "animate-pulse border-signal-orange bg-signal-orange",
                n.state === "pending" && "border-concrete bg-pure-white",
              )}
            />
            <span className={cx("t-mono-up mt-3 whitespace-nowrap", n.state === "pending" ? "text-slate" : "text-ink-black")}>{n.label}</span>
            {n.value && <span className={cx("t-mono tnum mt-1 whitespace-nowrap", n.state === "pending" ? "text-concrete" : "text-slate")}>{n.value}</span>}
          </div>
          {i < nodes.length - 1 && <span className={cx("mx-3 mt-[7px] h-px flex-1", n.state === "done" ? "bg-ink-black" : "bg-hairline")} />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-growing textarea: expands with content, never scrolls.         */
/* ------------------------------------------------------------------ */

export function AutoTextarea({ className, value, onChange, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      value={value}
      onChange={onChange}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      ref={(el) => {
        if (el) {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
      className={cx("autogrow", className)}
    />
  );
}
