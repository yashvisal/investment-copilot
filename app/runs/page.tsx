"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Nav } from "@/components/nav";
import { Empty, Eyebrow, Meta, Page, Spinner, cx } from "@/components/ui";
import { dateShort, usd } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  discovering: "Discovering",
  prioritizing: "Prioritizing",
  screening: "Screening",
  diligencing: "Diligence",
  complete: "Complete",
  failed: "Stopped",
};

const GRID = "grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-[1fr_110px_200px_80px]";

export default function RunsPage() {
  const runs = useQuery(api.runs.list);
  return (
    <>
      <Nav />
      <Page>
        <h1 className="t-display max-w-[620px] text-ink-black">Runs</h1>
        <p className="t-lead mt-5 max-w-[620px] text-graphite">Every thesis run so far, with what it found and what it spent.</p>

        <div className="mt-10">
          <div className={cx(GRID, "hidden border-b border-hairline pb-3 md:grid")}>
            <Eyebrow>Thesis</Eyebrow>
            <Eyebrow>Date</Eyebrow>
            <Eyebrow>Discovered · screened · deep</Eyebrow>
            <Eyebrow className="text-right">Spent</Eyebrow>
          </div>
          {runs === undefined && <Empty>Loading…</Empty>}
          {runs && runs.length === 0 && <Empty>No runs yet. Start one from the home page.</Empty>}
          <ol className="divide-y divide-hairline border-b border-hairline">
            {runs?.map((r) => {
              const active = r.status !== "complete" && r.status !== "failed";
              return (
                <li key={r._id}>
                  <Link href={`/runs/${r._id}`} className={cx(GRID, "group py-5 md:items-baseline")}>
                    <div className="min-w-0">
                      <p className="t-body text-ink-black group-hover:text-schematic-blue">{r.thesis}</p>
                      <Meta className="mt-1 flex items-center gap-2">
                        {active && <Spinner />}
                        <span className={cx(r.status === "failed" && "text-status-red")}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      </Meta>
                    </div>
                    <Meta className="tnum">{dateShort(r._creationTime)}</Meta>
                    <Meta className="tnum">
                      {r.stages.discover.count ?? 0} · {r.stages.screen.count ?? 0} · {r.stages.diligence.count ?? 0}
                    </Meta>
                    <Meta className="tnum md:text-right">{usd(r.spendUsd)}</Meta>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </Page>
    </>
  );
}
