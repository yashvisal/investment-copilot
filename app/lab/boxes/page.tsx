import { notFound } from "next/navigation";
import { BoxesPreview } from "@/components/boxes-preview";

/** Local-only layout experiment. Never renders in production. */
export default function BoxesLab() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BoxesPreview />;
}
