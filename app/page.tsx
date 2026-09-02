import { Nav } from "@/components/nav";
import { ThesisComposer } from "@/components/thesis-composer";
import { Page } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Nav />
      <Page>
        <h1 className="t-display mt-8 max-w-[620px] text-ink-black">A thesis in. The few companies worth a deeper look out.</h1>
        <p className="t-lead mt-5 max-w-[560px] text-graphite">
          Discovery, screening, and diligence on the open web, spending more only on the companies that earn it. Every claim
          carries its sources, its confidence, and an honest <span className="text-schematic-blue">unknown</span> when the web
          does not know.
        </p>
        <div className="mt-12">
          <ThesisComposer />
        </div>
      </Page>
    </>
  );
}
