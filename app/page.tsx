import { Nav } from "@/components/nav";
import { ThesisComposer } from "@/components/thesis-composer";
import { Page } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Nav />
      <Page>
        <div className="mt-12 max-w-[720px]">
          <h1 className="font-serif text-heading font-medium leading-[1.11] tracking-[0.012em] text-ink-black">
            Turn a thesis into the few private companies worth a deeper look.
          </h1>
          <p className="mt-4 font-serif text-heading-sm leading-[1.23] text-ink-black">
            Discover with FindAll, screen with cheap Tasks, spend real compute only on finalists.{" "}
            <span className="text-schematic-blue">Every claim carries its evidence.</span>
          </p>
        </div>
        <div className="mt-16">
          <ThesisComposer />
        </div>
      </Page>
    </>
  );
}
