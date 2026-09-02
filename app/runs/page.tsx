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
        <h1 className="t-display text-ink-black">Runs</h1>
        <ol className="mt-10 divide-y divide-hairline border-y border-hairline">
          {runs === undefined && <Empty>Loading…</Empty>}
          {runs && runs.length === 0 && <Empty>No runs yet.</Empty>}
          {runs?.map((r) => (
            <li key={r._id}>
              <Link href={`/runs/${r._id}`} className="group block py-5">
                <p className="t-body text-ink-black group-hover:text-schematic-blue">{r.thesis}</p>
                <Meta className="tnum mt-1">
                  {dateShort(r._creationTime)} · {r.status} · {r.stages.discover.count ?? 0} discovered, {r.stages.screen.count ?? 0} screened,{" "}
                  {r.stages.diligence.count ?? 0} diligenced · {usd(r.spendUsd)}
                </Meta>
              </Link>
            </li>
          ))}
        </ol>
      </Page>
    </>
  );
}
