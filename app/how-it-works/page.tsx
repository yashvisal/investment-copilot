import { Nav } from "@/components/nav";
import { PipelineGraph, type GraphNode } from "@/components/pipeline-graph";
import { ButtonLink, Page } from "@/components/ui";

const STEPS: GraphNode[] = [
  {
    id: "thesis",
    name: "Thesis",
    count: "1 line",
    cost: "Free",
    time: "Seconds",
    what: "You write the thesis in plain language. It becomes a short list of conditions every company must satisfy, and you can edit them before anything runs.",
    output: "Checkable conditions",
  },
  {
    id: "discover",
    name: "Discover",
    count: "10 to 25",
    cost: "$2 + $0.15 each",
    time: "3 to 8 min",
    what: "The open web is searched for companies that satisfy every condition. Each match arrives with evidence for each condition, a confidence level, and the pages it came from.",
    output: "Matched companies with evidence",
  },
  {
    id: "prioritize",
    name: "Prioritize",
    count: "Top 12",
    cost: "$0",
    time: "Instant",
    what: "Matches are ranked on the strength of their discovery evidence alone: how many conditions passed at high confidence, how many sources backed them, and whether the URL is the company's own. Nothing is spent here.",
    output: "A ranked shortlist",
  },
  {
    id: "screen",
    name: "Screen",
    count: "12",
    cost: "$0.03 each",
    time: "1 to 4 min",
    what: "A light research task establishes what each company sells, who buys it, funding stage, enterprise traction, and recent momentum. Fixed rules, not a model, sort each one into High priority, Investigate, or Pass.",
    output: "Ten cited facts and a class",
  },
  {
    id: "diligence",
    name: "Diligence",
    count: "At most 4",
    cost: "$0.10 each",
    time: "5 to 15 min",
    what: "Only finalists get a deep brief: product, customers, team, funding history, market, competition, momentum, bull case, bear case, and the questions the web cannot answer. Every section carries its sources and confidence.",
    output: "A memo with footnoted sources",
  },
  {
    id: "decide",
    name: "Decide",
    count: "You",
    cost: "$0",
    time: "Your call",
    what: "Mark each company Pass, Watch, or Deep diligence from the run board or inside a memo. Verify any source live. Track a company for material changes weekly.",
    output: "A watchlist worth human time",
  },
];

export default function HowItWorks() {
  return (
    <>
      <Nav />
      <Page>
        <h1 className="t-display mt-8 max-w-[620px] text-ink-black">Spend rises only as conviction does.</h1>
        <p className="t-lead mt-5 max-w-[600px] text-graphite">
          A thesis goes in. Each stage narrows the field and costs a little more per company than the last, so the deepest research
          only happens on the few that earned it. A ten-company run is about $4.
        </p>

        <div className="mt-12">
          <PipelineGraph nodes={STEPS} />
        </div>

        <section className="mt-16 grid grid-cols-1 gap-x-12 gap-y-6 border-t border-hairline pt-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="t-title text-ink-black">Every claim shows its work</h2>
            <p className="t-body mt-3 max-w-[560px] text-graphite">
              Each researched field is stored with its sources, the reasoning behind it, and a confidence level. The product reads
              those records directly, so it can say which claims are unsupported, which rest on conflicting sources, and which
              are simply unknown. When the web does not know, the page says so instead of guessing.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ButtonLink href="/" variant="orange">
              Run a thesis
            </ButtonLink>
            <ButtonLink href="/runs" variant="ghost">
              Past runs
            </ButtonLink>
          </div>
        </section>
      </Page>
    </>
  );
}
