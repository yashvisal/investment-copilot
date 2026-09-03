# Investment Copilot

A thesis goes in. The few companies worth a deeper look come out, with every claim carrying its sources, its confidence, and an honest "unknown" when the web does not know.

Built in a day on [Parallel](https://parallel.ai) as a portfolio piece for the Deployed Engineer role. Live at [investment-sourcing-copilot.vercel.app](https://investment-sourcing-copilot.vercel.app).

## The pipeline

```
Thesis ──▶ Discover ──▶ Prioritize ──▶ Screen ──▶ Diligence ──▶ Decide
           FindAll      our code       Task Group   Task          you
           core         free           core         pro
           10–20        top 10         10           at most 4
```

Spend rises only as conviction does. Each stage narrows the field and costs a little more per company than the last, so the strongest processor only ever runs on the handful that earned it. A ten-company run costs about $4 and takes 15 to 25 minutes end to end.

| Stage | Parallel primitive | Processor | Scope | Cost |
|---|---|---|---|---|
| Plan | FindAll `ingest` | free | one sentence → checkable conditions | $0 |
| Discover | FindAll `create` / `result` | `core` generator | 10, 15, or 20 matches | $2 + $0.15 per match |
| Prioritize | none | deterministic | top 10 by discovery evidence | $0 |
| Screen | Task Group, 10 runs concurrently | `core` | ten cited facts per company | $0.025 per run |
| Diligence | Task runs, created concurrently | `pro` | 16-field memo with footnoted sources | $0.10 per run |
| Verify a source | Extract | n/a | re-fetch the page, check the passage is still there | $0.001 per URL |
| Track changes | Monitor `snapshot` | `lite` | weekly re-run of the screen | flag-gated |

## Decisions and why

**FindAll for discovery, not search.** Search returns pages. FindAll returns entities that each satisfy every planned condition, with per-condition evidence and confidence. That evidence is what makes the free prioritization step possible: we rank on how many conditions passed at high confidence, how many sources backed them, and whether the URL is the company's own site. No model call, no cost.

**The thesis is the whole objective.** An early version appended a hidden "objective hint" to every thesis so results skewed early-stage. When a legal-tech thesis was planned against an AI-infrastructure hint, discovery evaluated 67 candidates and matched none, because the conditions contradicted each other. The hint is gone. What you type is exactly what gets planned. If you want early-stage, say so in the sentence and it becomes a condition like any other.

**Core everywhere except diligence.** Screening uses the `core` processor inside a Task Group so all ten runs execute at once. Diligence uses `pro` because that is where depth matters, and the four tasks are created concurrently rather than in sequence. Neither `-fast` variant is used; the docs steer away from them for research quality.

**Facts from the model, verdicts from code.** The screening task returns nullable facts only. A rules function in `lib/parallel/classify.ts` maps those facts and their confidence to Pass, Investigate, or High priority, with human-readable reasons. The model never votes, so the policy is tunable and testable. Only acquisitions, shutdowns, subsidiaries, and a clear sector miss disqualify a company. Stage, size, and public listing never do unless the thesis asks.

**Research basis as a first-class record.** Every researched field becomes a `claim` row: value, reasoning, confidence, citations with excerpts, plus derived `supported`, `conflicting`, and `isUnknown` flags. The company page reads claims, not raw task output. That is what powers the evidence strip, bracketed footnotes, conflict flags, and the "Unknown: insufficient credible evidence" rendering.

**Progress from the event stream.** While diligence runs, the poller opens each task's SSE event stream for a few seconds and harvests the latest progress message, so the run page shows what the research is doing rather than a spinner.

**A stall watchdog.** One discovery job found 100 candidates in sixteen minutes and never began evaluating them. Our poller would have waited indefinitely. It now fails the run and cancels the job upstream if nothing has been checked after five minutes or nothing has moved for four, and the discover view reports found, checked, and matched as three separate numbers.

**Monitors behind a flag.** Weekly change tracking is fully implemented on the Monitor API but gated by `ENABLE_MONITORS`, so a public demo cannot accrue recurring charges.

**A budget with a hard stop.** A Convex counter holds the project's research allocation. Each run's actual spend is added on completion. If a new run's estimate exceeds what remains, it is refused with a message that says who to ask. Parallel's balance endpoint needs an OAuth account token, not an API key, so the counter is ours.

## What is not Parallel

The wand next to the thesis box streams a demo-friendly thesis from OpenAI through a Next.js route handler. It exists so the demo never stalls on a blank box. Everything that touches the web is Parallel.

## Architecture

- `convex/` holds the schema and the pipeline. Stages are Convex Node actions chained by the scheduler and polled every eight seconds, so no HTTP request ever waits on Parallel and the pipeline survives serverless timeouts. Runs, companies, claims, events, and the budget are all live queries, so the UI updates as work lands.
- `lib/parallel/` is pure TypeScript shared by Convex and the UI: task specs with per-field prompts, the cost model, basis normalization, prioritization, and classification.
- `app/` is the Next.js App Router UI. Home, run board, company memo, runs list, and a how-it-works page. The home page preloads the latest run on the server so nothing pops in.

## Running locally

```bash
pnpm install
cp .env.example .env.local        # PARALLEL_API_KEY, OPENAI_API_KEY
npx convex dev                     # creates a dev deployment, writes NEXT_PUBLIC_CONVEX_URL
npx convex env set PARALLEL_API_KEY <key>
npx convex env set OPENAI_API_KEY <key>
npx convex env set ENABLE_MONITORS false
pnpm dev
```

Deploys are `npx convex deploy` for the backend and `vercel deploy --prod` for the frontend.

## Design

White canvas, one grotesque sans for reading, one mono for interface chrome, hairline borders, 2px radii, a single orange accent for the moments that cost money. Modeled on parallel.ai itself. Inter and IBM Plex Mono stand in for Parallel's proprietary faces.
