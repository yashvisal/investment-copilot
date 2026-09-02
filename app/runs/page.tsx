"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Nav } from "@/components/nav";
import { Empty, Meta, Page } from "@/components/ui";
import { dateShort, usd } from "@/lib/format";

export default function RunsPage() {
  const runs = useQuery(api.runs.list);
  return (
    <>
      <Nav />
      <Page>
        <h1 className="mt-10 text-heading-sm font-medium text-ink-black">Runs</h1>
        <ol className="mt-6 divide-y divide-hairline border-t border-hairline">
          {runs === undefined && <Empty>Loading…</Empty>}
          {runs && runs.length === 0 && <Empty>No runs yet.</Empty>}
          {runs?.map((r) => (
            <li key={r._id}>
              <Link href={`/runs/${r._id}`} className="group block py-4">
                <p className="text-base text-ink-black group-hover:text-schematic-blue">{r.thesis}</p>
                <Meta className="mt-1 tnum">
                  {dateShort(r._creationTime)} · {r.status} · {r.stages.discover.count ?? 0} discovered, {r.stages.screen.count ?? 0} screened, {r.stages.diligence.count ?? 0} diligenced · {usd(r.spendUsd)}
                </Meta>
              </Link>
            </li>
          ))}
        </ol>
      </Page>
    </>
  );
}
