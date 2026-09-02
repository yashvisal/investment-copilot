import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Classification, Confidence, Decision } from "@/lib/parallel/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export { cx };

/* Buttons. Radius is always 2px. Only fill and border vary. */

type ButtonVariant = "dark" | "orange" | "ghost" | "quiet";

const buttonBase =
  "chrome inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-label leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  dark: "bg-ink-black text-cream-paper hover:bg-graphite",
  orange: "bg-signal-orange text-pure-white hover:brightness-95",
  ghost: "border border-hairline bg-transparent text-ink-black hover:bg-fog",
  quiet: "bg-transparent text-graphite hover:text-ink-black",
};

export function Button({
  variant = "ghost",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "ghost",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

/* Inset annotation tag: mono, uppercase, hairline border. */

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "fog" | "blue" | "green" | "amber" | "red" | "ink";
  className?: string;
}) {
  const tones = {
    neutral: "border-hairline text-ink-black",
    fog: "border-hairline bg-fog text-graphite",
    blue: "border-schematic-blue/30 text-schematic-blue",
    green: "border-status-green/30 text-status-green",
    amber: "border-status-amber/30 text-status-amber",
    red: "border-status-red/30 text-status-red",
    ink: "border-ink-black bg-ink-black text-cream-paper",
  };
  return (
    <span
      className={cx(
        "chrome inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-caption leading-[1.5] whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ConfidenceTag({ confidence }: { confidence: Confidence | null }) {
  if (!confidence) return <Tag tone="fog">No confidence</Tag>;
  const tone = confidence === "high" ? "green" : confidence === "medium" ? "amber" : "red";
  return <Tag tone={tone}>{confidence} confidence</Tag>;
}

export const CLASS_LABEL: Record<Classification, string> = {
  high_priority: "High priority",
  investigate: "Investigate",
  pass: "Pass",
};

export function ClassTag({ classification }: { classification: Classification | undefined }) {
  if (!classification) return <Tag tone="fog">Unscreened</Tag>;
  const tone = classification === "high_priority" ? "blue" : classification === "investigate" ? "neutral" : "fog";
  return <Tag tone={tone}>{CLASS_LABEL[classification]}</Tag>;
}

export const DECISION_LABEL: Record<Decision, string> = {
  pass: "Pass",
  watch: "Watch",
  deep_diligence: "Deep diligence",
};

export function DecisionTag({ decision }: { decision: Decision | undefined }) {
  if (!decision) return null;
  const tone = decision === "deep_diligence" ? "ink" : decision === "watch" ? "blue" : "fog";
  return <Tag tone={tone}>{DECISION_LABEL[decision]}</Tag>;
}

/* Layout primitives */

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-[1200px] px-6 pb-20", className)}>{children}</main>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("chrome text-label text-slate", className)}>{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-sm border border-hairline bg-cream-paper", className)}>{children}</div>;
}

export function Dot({ tone = "slate", pulse = false }: { tone?: "slate" | "green" | "orange" | "blue" | "red"; pulse?: boolean }) {
  const colors = {
    slate: "bg-concrete",
    green: "bg-status-green",
    orange: "bg-signal-orange",
    blue: "bg-schematic-blue",
    red: "bg-status-red",
  };
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", colors[tone])} />}
      <span className={cx("relative inline-flex h-2 w-2 rounded-full", colors[tone])} />
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-hairline px-6 py-10 text-center text-body text-slate">{children}</div>;
}
