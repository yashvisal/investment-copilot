"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ButtonLink } from "./ui";

export function Nav() {
  const budget = useQuery(api.budget.get);
  const left = budget ? `$${budget.remainingUsd.toFixed(2)} left` : "";
  return (
    <header className="flex w-full items-center justify-between px-8 py-6">
      <Link href="/" className="t-body font-medium text-ink-black">
        Investment Copilot
      </Link>
      <div className="flex items-center gap-3">
        <span className="t-mono tnum mr-3 text-slate">{left}</span>
        <ButtonLink href="/runs" variant="ghost">
          Runs
        </ButtonLink>
        <ButtonLink href="/how-it-works" variant="dark">
          How it works
        </ButtonLink>
      </div>
    </header>
  );
}
