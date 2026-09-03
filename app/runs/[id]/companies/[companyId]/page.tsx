import { CompanyView } from "@/components/company-view";
import type { Id } from "@/convex/_generated/dataModel";

export default async function CompanyPage({ params }: { params: Promise<{ id: string; companyId: string }> }) {
  const { id, companyId } = await params;
  return <CompanyView runId={id as Id<"runs">} companyId={companyId as Id<"companies">} />;
}
