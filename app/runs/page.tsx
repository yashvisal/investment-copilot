"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Nav } from "@/components/nav";
import { Empty, Meta, Page, Spinner, cx } from "@/components/ui";
import { dateShort } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  discovering: "Discovering",
  prioritizing: "Prioritizing",
  screening: "Screening",
  diligencing: "Diligence",
  complete: "Complete",
  failed: "Stopped",
};

export default function RunsPage() {
  const runs = useQuery(api.runs.list);
  return (
    <>
      <Nav />
      <Page>
        <h1 className="t-display max-w-[620px] text-ink-black">Runs</h1>
        <p className="t-lead mt-5 max-w-[620px] text-graphite">Every thesis run so far. Open one to see what it found.</p>

        <div className="mt-10">
          {runs === undefined && <Empty>Loading…</Empty>}
          {runs && runs.length === 0 && <Empty>No runs yet. Start one from the home page.</Empty>}
          <ol className="space-y-3">
            {runs?.map((r) => {
              const active = r.status !== "complete" && r.status !== "failed";
              return (
                <li key={r._id}>
                  <Link
                    href={`/runs/${r._id}`}
                    className="group block rounded-sm border border-hairline bg-pure-white p-5 shadow-sm transition-colors hover:border-ink-black"
                  >
                    <p className="t-lead text-ink-black">{r.thesis}</p>
                    <Meta className="tnum mt-3 flex items-center gap-2">
                      <span>{dateShort(r._creationTime)}</span>
                      <span>·</span>
                      {active && <Spinner />}
                      <span className={cx(r.status === "failed" && "text-status-red")}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      <span className="ml-auto text-concrete transition-colors group-hover:text-ink-black">Open →</span>
                    </Meta>
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
