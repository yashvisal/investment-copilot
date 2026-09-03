# Investment Copilot

Turn an investment thesis into the few private companies actually worth a deeper look. Built on [Parallel](https://parallel.ai) FindAll, Task, Responses, Extract, and Monitor, with Convex for run state and Next.js on Vercel.

The product is not an autonomous investor. It compresses the hours an investor spends searching the open web before deciding whether a company deserves real diligence, and it shows its evidence at every step.

## The funnel

```
Thesis → Discover → Prioritize → Screen → Diligence → Decide
          FindAll     our code    Task      Task       human
          core        $0          core      pro
```

Spend rises with conviction. Discovery is broad and uses FindAll's `core` generator. Prioritization is deterministic and free, using only FindAll's match-condition outputs and their confidence. The top 10 are screened with a `core` Task Group. At most four finalists get a `pro` diligence task. The strongest processor never runs across the whole set.

| Stage | Primitive | Processor | Cap | Unit cost |
|---|---|---|---|---|
| Estimate | FindAll ingest | n/a | free | $0 |
| Discover | FindAll run | `core` | 10, 15, or 20 | $2.00 + $0.15 per match |
| Prioritize | none | n/a | top 10 | $0 |
| Screen | Task Group | `core` | 10 | $0.025 per run |
| Diligence | Task | `pro` | 4 | $0.10 per run |
| Follow-up question | Responses API | effort `low` | on demand | $0.01 per request |
| Verify citation | Extract | n/a | on demand | $0.001 per URL |
| Watch company | Monitor `snapshot` | `lite` | flag-gated | $0.003 per execution |

A 10-company run is about $4.15. The thesis page shows this estimate before anything is spent.

## Research basis as a first-class record

Every researched field becomes a `claim` row: value, reasoning, confidence, citations with excerpts, and derived flags for `supported`, `conflicting`, and `isUnknown`. The company page reads from claims, not from nested task output. That is what powers the evidence strip, the unsupported-claim list, conflict flags, the "Unknown: insufficient credible evidence" rendering, and later the eval suite.

Classification is deterministic. The screening task returns nullable facts; a rules function in `lib/parallel/classify.ts` maps facts and confidence to Pass, Investigate, or High priority with human-readable reasons. The model never votes on the verdict, so screening agreement in evals measures a policy you can tune.

## Cost controls

- Match limit is a fixed choice: 10, 15, or 20. Prioritization keeps the top 10, so a 10-company discovery screens everything it found.
- Screening and diligence caps are enforced server-side.
- A project research budget lives in Convex. Each run's actual spend is added to it. If the estimate for a new run exceeds what remains, the run is refused and the UI explains how to request more.
- Monitoring is implemented behind `ENABLE_MONITORS`. The public demo shows the "disabled to avoid ongoing API costs" message; production flips the flag.

## Architecture

- `convex/` holds the schema and the pipeline. Stages are Convex Node actions chained by the scheduler and polled every eight seconds, so no request ever waits on Parallel and the pipeline survives Vercel's function timeout.
- `lib/parallel/` is pure TypeScript: task specs, the cost model, basis normalization, prioritization, and classification. Shared by Convex actions, the UI, and scripts.
- `app/` is the Next.js App Router UI. Three views: thesis, run, company. The run page subscribes to Convex, so candidates appear as FindAll matches them and screens fill in as tasks complete.

## Running locally

```bash
pnpm install
cp .env.example .env.local   # add PARALLEL_API_KEY
npx convex dev               # creates a dev deployment, writes NEXT_PUBLIC_CONVEX_URL
npx convex env set PARALLEL_API_KEY <key>
npx convex env set ENABLE_MONITORS false
npx convex env set ENABLE_LIVE_RUNS true
pnpm dev
```

## Design

Styled after Parallel's own system: cream canvas, serif for reading, monospace for interface chrome, hairline borders, 2px radii. See `DESIGN.md`. Parallel's typefaces are proprietary, so Source Serif 4 and IBM Plex Mono stand in.
