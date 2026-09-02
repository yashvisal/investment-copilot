import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Classification, Decision } from "@/lib/parallel/types";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "dark" | "orange" | "ghost" | "quiet";

const buttonBase =
  "chrome inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-label uppercase leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const buttonVariants: Record<ButtonVariant, string> = {
  dark: "bg-ink-black text-cream-paper hover:bg-graphite",
  orange: "bg-signal-orange text-pure-white hover:brightness-95",
  ghost: "border border-hairline bg-transparent text-ink-black hover:bg-fog",
  quiet: "bg-transparent px-0 text-slate hover:text-ink-black",
};

export function Button({ variant = "ghost", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "ghost", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-[760px] px-6 pb-24", className)}>{children}</main>;
}

/** Small mono caption used sparingly for metadata lines. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("font-mono text-ui text-slate", className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-base text-slate">{children}</p>;
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
