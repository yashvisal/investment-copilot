import { Nav } from "@/components/nav";
import { ThesisComposer } from "@/components/thesis-composer";
import { Page } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Nav />
      <Page>
        <h1 className="mt-16 max-w-[620px] text-heading font-medium leading-[1.11] tracking-[0.012em] text-ink-black">
          A thesis in. The few companies worth a deeper look out.
        </h1>
        <p className="mt-4 max-w-[560px] text-base leading-[1.6] text-graphite">
          Parallel discovers and researches. Spend rises only as conviction does. Every claim carries its sources, its confidence,
          and an honest <span className="text-schematic-blue">unknown</span> when the web does not know.
        </p>
        <div className="mt-16">
          <ThesisComposer />
        </div>
      </Page>
    </>
  );
}
