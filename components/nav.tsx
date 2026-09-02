"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usd } from "@/lib/format";

export function Nav() {
  const budget = useQuery(api.budget.get);
  return (
    <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-5">
      <Link href="/" className="font-serif text-body font-medium text-ink-black">
        Investment Copilot
      </Link>
      <nav className="chrome flex items-center gap-6 text-label text-slate">
        <Link href="/" className="hover:text-ink-black">
          Thesis
        </Link>
        <Link href="/runs" className="hover:text-ink-black">
          Runs
        </Link>
        <a href="https://docs.parallel.ai" target="_blank" rel="noreferrer" className="hover:text-ink-black">
          Parallel docs
        </a>
      </nav>
      <div className="chrome flex items-center gap-3 text-label text-graphite">
        <span className="text-slate">Research budget</span>
        <span className="tnum text-ink-black">
          {budget ? `${usd(budget.remainingUsd)} of ${usd(budget.allocatedUsd)}` : "…"}
        </span>
      </div>
    </header>
  );
}
