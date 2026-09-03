"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ButtonLink, Skeleton, cx } from "./ui";

export function Nav() {
  const budget = useQuery(api.budget.get);
  const path = usePathname();
  const left = budget ? `$${budget.remainingUsd.toFixed(2)} left` : "";
  return (
    <header className="sticky top-0 z-40 w-full border-b border-hairline/70 bg-pure-white/80 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-8">
        <Link href="/" className="t-body font-medium text-ink-black">
          Investment Copilot
        </Link>
        <div className="flex items-center gap-3">
          <span className="t-mono tnum mr-3 inline-flex min-w-[80px] justify-end text-slate">
            {budget ? left : <Skeleton className="h-3 w-16" />}
          </span>
          <ButtonLink href="/runs" variant="ghost" className={cx(path.startsWith("/runs") && "bg-fog")}>
            Runs
          </ButtonLink>
          <ButtonLink href="/how-it-works" variant="dark">
            How it works
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
