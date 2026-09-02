"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usd } from "@/lib/format";

export function Nav() {
  const budget = useQuery(api.budget.get);
  return (
    <header className="mx-auto flex w-full max-w-[760px] items-baseline justify-between px-6 py-6">
      <Link href="/" className="text-body font-medium text-ink-black">
        Investment Copilot
      </Link>
      <div className="flex items-baseline gap-6 font-mono text-ui text-slate">
        <Link href="/runs" className="hover:text-ink-black">
          Runs
        </Link>
        <span className="tnum">{budget ? `${usd(budget.remainingUsd)} left of ${usd(budget.allocatedUsd)}` : ""}</span>
      </div>
    </header>
  );
}
