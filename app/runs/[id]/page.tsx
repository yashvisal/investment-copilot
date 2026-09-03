import { RunView } from "@/components/run-view";
import type { Id } from "@/convex/_generated/dataModel";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunView runId={id as Id<"runs">} />;
}
