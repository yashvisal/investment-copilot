"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Nav } from "@/components/nav";
import { Empty, Page, SectionLabel, Tag } from "@/components/ui";
import { dateShort, usd } from "@/lib/format";

export default function RunsPage() {
  const runs = useQuery(api.runs.list);
  return (
    <>
      <Nav />
      <Page>
        <div className="mt-12 flex items-baseline justify-between">
          <h1 className="font-serif text-heading-sm font-medium text-ink-black">Runs</h1>
          <SectionLabel>{runs ? `${runs.length} total` : ""}</SectionLabel>
        </div>
        <div className="mt-6 divide-y divide-hairline border-t border-hairline">
          {runs === undefined && <p className="py-6 text-small text-slate">Loading…</p>}
          {runs && runs.length === 0 && <Empty>No runs yet.</Empty>}
          {runs?.map((r) => (
            <Link key={r._id} href={`/runs/${r._id}`} className="flex items-center gap-6 py-4 hover:bg-fog/60">
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-base text-ink-black">{r.thesis}</div>
                <div className="chrome mt-1 text-caption text-slate">
                  {dateShort(r._creationTime)} · {r.matchLimit} discovered cap · {r.stages.discover.count ?? 0} matched · {r.stages.screen.count ?? 0} screened · {r.stages.diligence.count ?? 0} diligenced
                </div>
              </div>
              <span className="tnum text-small text-graphite">{usd(r.spendUsd)}</span>
              <Tag tone={r.status === "complete" ? "green" : r.status === "failed" ? "red" : "blue"}>{r.status}</Tag>
            </Link>
          ))}
        </div>
      </Page>
    </>
  );
}
