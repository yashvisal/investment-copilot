"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RunView } from "./run-view";

/** Renders the latest completed run with boxed company rows, for comparison. */
export function BoxesPreview() {
  const canonical = useQuery(api.runs.canonical);
  if (canonical === undefined) return null;
  if (canonical === null) return <p className="p-8">No completed run to preview.</p>;
  return <RunView runId={canonical._id} boxed />;
}
