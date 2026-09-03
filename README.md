# Investment Copilot

A thesis goes in. The few companies worth a deeper look come out, with every claim carrying its sources, its confidence, and an honest "unknown" when the web does not know.

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

**Core everywhere except diligence.** Screening uses the `core` processor inside a Task Group so all ten runs execute at once. Diligence uses `pro` because that is where depth matters, and the four tasks are created concurrently rather than in sequence. The `-fast` variants are not used; the docs steer away from them for research quality.

**Facts from the model, verdicts from code.** The screening task returns nullable facts only. A rules function in `lib/parallel/classify.ts` maps those facts and their confidence to Pass, Investigate, or High priority, with human-readable reasons. The model never votes, so the policy is tunable and testable. Only acquisitions, shutdowns, subsidiaries, and a clear sector miss disqualify a company. Stage, size, and public listing never do unless the thesis asks.

**Research basis as a first-class record.** Every researched field becomes a `claim` row: value, reasoning, confidence, citations with excerpts, plus derived `supported`, `conflicting`, and `isUnknown` flags. The company page reads claims, not raw task output. That is what powers the evidence strip, bracketed footnotes, conflict flags, and the "Unknown: insufficient credible evidence" rendering.

**Monitors behind a flag.** Weekly change tracking is fully implemented on the Monitor API but gated by `ENABLE_MONITORS`, so a public demo cannot accrue recurring charges.

**A budget with a hard stop.** A research allocation lives in Convex. Each run's actual spend is added on completion. If a new run's estimate exceeds what remains, it is refused with a message that says who to ask.
