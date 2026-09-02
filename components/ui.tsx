import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Classification, Decision } from "@/lib/parallel/types";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "dark" | "orange" | "ghost";

const buttonBase =
  "t-mono-up inline-flex h-9 items-center justify-center gap-2 rounded-sm px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const buttonVariants: Record<ButtonVariant, string> = {
  dark: "bg-ink-black text-pure-white hover:bg-graphite",
  orange: "bg-signal-orange text-pure-white hover:brightness-95",
  ghost: "border border-hairline bg-transparent text-ink-black hover:bg-fog",
};

export function Button({ variant = "ghost", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "ghost", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

/** The single content container. Every page uses it. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-[720px] px-6 pb-32 pt-12", className)}>{children}</main>;
}

/** Mono metadata line. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("t-mono text-slate", className)}>{children}</div>;
}

/** Section heading: mono eyebrow above, used for every secondary section. */
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

export function Spinner() {
  return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-signal-orange align-middle" />;
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
                n.state === "active" && "border-signal-orange bg-signal-orange animate-pulse",
                n.state === "pending" && "border-concrete bg-pure-white",
              )}
            />
            <span className={cx("t-mono-up mt-3 whitespace-nowrap", n.state === "pending" ? "text-slate" : "text-ink-black")}>{n.label}</span>
            {n.value && <span className={cx("t-mono mt-1 whitespace-nowrap tnum", n.state === "pending" ? "text-concrete" : "text-slate")}>{n.value}</span>}
          </div>
          {i < nodes.length - 1 && (
            <span className={cx("mx-3 mt-[7px] h-px flex-1", n.state === "done" ? "bg-ink-black" : "bg-hairline")} />
          )}
        </div>
      ))}
    </div>
  );
}
