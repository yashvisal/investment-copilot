import { Nav } from "@/components/nav";
import { ButtonLink, Eyebrow, Page } from "@/components/ui";

type Step = { name: string; count: string; cost: string; time: string; what: string; output: string };

const STEPS: Step[] = [
  {
    name: "Thesis",
    count: "1 sentence",
    cost: "Free",
    time: "Seconds",
    what: "You write the thesis in plain language. It becomes a short list of conditions every company must satisfy, and you can edit them before anything runs.",
    output: "Checkable conditions",
  },
  {
    name: "Discover",
    count: "10 to 25",
    cost: "$2 + $0.15 each",
    time: "3 to 8 min",
    what: "The open web is searched for companies that satisfy every condition. Each match arrives with evidence for each condition, a confidence level, and the pages it came from.",
    output: "Matched companies with evidence",
  },
  {
    name: "Prioritize",
    count: "Top 12",
    cost: "$0",
    time: "Instant",
    what: "Matches are ranked on the strength of their discovery evidence alone: how many conditions passed at high confidence, how many sources backed them, and whether the URL is the company's own.",
    output: "A ranked shortlist",
  },
  {
    name: "Screen",
    count: "12",
    cost: "$0.03 each",
    time: "1 to 4 min",
    what: "A light research task establishes what each company sells, who buys it, funding stage, enterprise traction, and recent momentum. Fixed rules, not a model, sort each one into High priority, Investigate, or Pass.",
    output: "Ten cited facts and a class",
  },
  {
    name: "Diligence",
    count: "At most 4",
    cost: "$0.10 each",
    time: "5 to 15 min",
    what: "Only finalists get a deep brief: product, customers, team, funding history, market, competition, momentum, bull case, bear case, and the questions the web cannot answer. Every section carries its sources and confidence.",
    output: "A memo with footnoted sources",
  },
  {
    name: "Decide",
    count: "You",
    cost: "$0",
    time: "Your call",
    what: "Mark each company Pass, Watch, or Deep diligence from the run page or inside a memo. Ask follow-up questions and get cited answers in seconds. Verify any source live. Watch a company for weekly changes.",
    output: "A watchlist worth human time",
  },
];

export default function HowItWorks() {
  return (
    <>
      <Nav />
      <Page width="wide">
        <h1 className="t-display mt-8 max-w-[620px] text-ink-black">Spend rises only as conviction does.</h1>
        <p className="t-lead mt-5 max-w-[600px] text-graphite">
          A thesis goes in. Each stage narrows the field and costs a little more per company than the last, so the deepest research
          only happens on the few that earned it. A ten-company run is about $4.
        </p>

        {/* Node grid */}
        <ol className="mt-14 grid grid-cols-2 gap-x-0 gap-y-8 md:grid-cols-3 lg:grid-cols-6" aria-label="Pipeline">
          {STEPS.map((s, i) => (
            <li key={s.name} className="relative pr-6">
              <div className="flex items-center">
                <span className="block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink-black bg-ink-black" />
                {i < STEPS.length - 1 && <span className="ml-2 h-px flex-1 bg-hairline" />}
              </div>
              <div className="mt-4 rounded-sm border border-hairline bg-pure-white p-4">
                <div className="t-mono-up text-ink-black">{s.name}</div>
                <div className="t-title tnum mt-3 text-ink-black">{s.count}</div>
                <div className="t-mono tnum mt-3 text-slate">{s.cost}</div>
                <div className="t-mono tnum text-slate">{s.time}</div>
              </div>
            </li>
          ))}
        </ol>

        {/* Description grid */}
        <div className="mt-16 grid grid-cols-1 gap-x-12 gap-y-10 border-t border-hairline pt-10 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <section key={s.name}>
              <h2 className="t-body font-medium text-ink-black">{s.name}</h2>
              <p className="t-small mt-2 text-graphite">{s.what}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <Eyebrow>Produces</Eyebrow>
                <span className="t-small text-ink-black">{s.output}</span>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16 grid grid-cols-1 gap-x-12 gap-y-6 border-t border-hairline pt-10 md:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="t-title text-ink-black">Every claim shows its work</h2>
            <p className="t-body mt-3 max-w-[520px] text-graphite">
              Each researched field is stored with its sources, the reasoning behind it, and a confidence level. The product reads
              those records directly, so it can say which claims are unsupported, which rest on conflicting sources, and which
              are simply unknown. When the web does not know, the page says so instead of guessing.
            </p>
          </div>
          <div className="flex items-start gap-3 md:justify-end">
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
