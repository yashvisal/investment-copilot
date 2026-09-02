import { Nav } from "@/components/nav";
import { ButtonLink, Eyebrow, Page } from "@/components/ui";

const STEPS: Array<{ name: string; count: string; cost: string; time: string; what: string; output: string }> = [
  {
    name: "Thesis",
    count: "1 sentence",
    cost: "Free",
    time: "Seconds",
    what: "You write the thesis in plain language. It is turned into a short list of conditions every company must satisfy, and you can edit them before anything runs.",
    output: "Six checkable conditions",
  },
  {
    name: "Discover",
    count: "Up to 25 companies",
    cost: "$2 + $0.15 each",
    time: "3 to 8 minutes",
    what: "The open web is searched for companies that satisfy every condition. Each match arrives with evidence for each condition, a confidence level, and the pages it came from.",
    output: "Matched companies with per-condition evidence",
  },
  {
    name: "Prioritize",
    count: "Top 12",
    cost: "$0",
    time: "Instant",
    what: "Matches are ranked on the strength of their discovery evidence alone: how many conditions passed at high confidence, how many sources backed them, and whether the URL is the company's own. No research is spent here.",
    output: "A ranked shortlist",
  },
  {
    name: "Screen",
    count: "12 companies",
    cost: "$0.03 each",
    time: "1 to 4 minutes",
    what: "A light research task establishes what each company sells, who buys it, funding stage, enterprise traction, and recent momentum. Fixed rules, not a model, then sort each company into High priority, Investigate, or Pass.",
    output: "Ten cited facts and a classification per company",
  },
  {
    name: "Diligence",
    count: "At most 4",
    cost: "$0.10 each",
    time: "5 to 15 minutes",
    what: "Only finalists get a deep brief: product, customers, team, funding history, market, competition, momentum, bull case, bear case, and the questions the web cannot answer. Every section carries its sources and confidence.",
    output: "A pre-diligence memo with footnoted sources",
  },
  {
    name: "Decide",
    count: "You",
    cost: "$0",
    time: "Your call",
    what: "Mark each company Pass, Watch, or Deep diligence. Ask follow-up questions and get cited answers in seconds. Verify any source live. Watch a company for weekly changes.",
    output: "A watchlist worth real human time",
  },
];

export default function HowItWorks() {
  return (
    <>
      <Nav />
      <Page>
        <h1 className="t-display text-ink-black">Spend rises only as conviction does.</h1>
        <p className="t-lead mt-5 max-w-[600px] text-graphite">
          A thesis goes in. Each stage narrows the field and costs a little more per company than the last, so the expensive
          research only happens on the few that earned it. A ten-company run is about $4.
        </p>

        <ol className="mt-16">
          {STEPS.map((s, i) => (
            <li key={s.name} className="relative grid grid-cols-[24px_1fr] gap-x-6">
              <div className="flex flex-col items-center">
                <span className="mt-[7px] block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink-black bg-ink-black" />
                {i < STEPS.length - 1 && <span className="w-px flex-1 bg-hairline" />}
              </div>
              <div className="pb-12">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="t-title text-ink-black">{s.name}</h2>
                  <span className="t-mono tnum text-slate">
                    {s.count} · {s.cost} · {s.time}
                  </span>
                </div>
                <p className="t-body mt-3 max-w-[560px] text-graphite">{s.what}</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <Eyebrow>Produces</Eyebrow>
                  <span className="t-small text-ink-black">{s.output}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <section className="border-t border-hairline pt-8">
          <h2 className="t-title text-ink-black">Every claim shows its work</h2>
          <p className="t-body mt-3 max-w-[560px] text-graphite">
            Each researched field is stored with its sources, the reasoning behind it, and a confidence level. The product reads
            those records directly, so it can say which claims are unsupported, which have conflicting sources, and which are
            simply unknown. When the web does not know, the page says so instead of guessing.
          </p>
          <div className="mt-8 flex gap-3">
            <ButtonLink href="/" variant="orange">
              Run a thesis
            </ButtonLink>
            <ButtonLink href="/runs" variant="ghost">
              See past runs
            </ButtonLink>
          </div>
        </section>
      </Page>
    </>
  );
}
