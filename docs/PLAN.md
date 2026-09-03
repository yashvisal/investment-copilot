# Investment Copilot: build plan

Thesis in, researched shortlist out. Built on Parallel FindAll, Task, Responses, Search, Extract, and Monitor. Deployed on Vercel with Convex for run state.

## Pipeline

| Stage | Parallel primitive | Processor | Cap | Est. latency | Est. cost |
|---|---|---|---|---|---|
| Estimate | FindAll `preview` | preview | 10 candidates | 1-2 min | $0.10 |
| Discover | FindAll run | `core` generator | user picks 10 / 15 / 20 | 3-8 min | $2 + $0.15/match |
| Prioritize | none (our code) | n/a | top 10 | instant | $0 |
| Screen | Task Group | `base` | 10 | 1-3 min | $0.01/run |
| Diligence | Task run | `pro` | MAX_DILIGENCE=4 | 3-8 min | $0.10/run |
| Follow-up | Responses API | effort `low` | on demand | 5-10 s | $0.01/request |
| Verify citation | Extract | n/a | on demand | 1-5 s | $0.001/url |
| Watch | Monitor `snapshot` on the screen task run | `lite` | flag-gated | weekly | $0.003/exec |

Classification is deterministic and lives in our code, not in the model. Screening returns nullable facts plus per-field `basis`; a rules function maps facts and confidence to Pass / Investigate / High Priority. The diligence page never asks the model for a verdict; the user chooses Pass / Watch / Deep Diligence.

## Data model (Convex)

- `runs`: thesis text, status (`draft | estimating | discovering | screening | diligencing | complete | failed`), stage timestamps, caps, budget, spend by stage, Parallel ids (findall_id, taskgroup_id).
- `companies`: run ref, name, url, description, findall candidate id, match-condition outputs and basis, screen output and basis, screen classification, diligence output and basis, diligence task run id, user decision, monitor id.
- `events`: run ref, stage, message, timestamp. Feeds the live progress log.
- `evalLabels`: company ref, human labels for the eval script.

## Server architecture

- `convex/` holds schema, queries, mutations, and the pipeline as Convex actions with the scheduler chaining stages. Each stage is idempotent and resumable: it records Parallel ids first, then polls or streams, then writes results. This avoids the Vercel 300 s function limit entirely.
- `lib/parallel/` holds the SDK client, task specs (schemas), the cost model, and the classification rules. Pure TypeScript, unit-testable, shared by Convex actions and the eval script.
- Next.js route handlers only for on-demand synchronous calls: Responses follow-up, Extract verify, and a Parallel webhook receiver (optional, SSE polling from actions is the primary path).

## UI

Three views, all on cream paper, serif for reading, mono for chrome.

1. **Thesis** (`/`): the thesis as an editorial headline, the cost estimate table, caps, and Run. Below it, prior runs.
2. **Run** (`/runs/[id]`): a horizontal pipeline rail (Discover, Screen, Diligence, Decide) with the live stage, elapsed and expected time, count, and spend per stage. Under it, the funnel header (30 discovered, 12 screened, 4 diligenced, 2 watchlist) and the company table. Rows fill in live from Convex as candidates match and screens complete. While a stage is running, a mono log streams Parallel progress messages in a narrow column, styled like the data-stream panel in DESIGN.md.
3. **Company** (`/runs/[id]/companies/[companyId]`): Thesis, Diligence, Evidence tabs. Every claim carries its confidence and citation count. Unknowns render as "Unknown: insufficient credible evidence". The Evidence tab lists citations with excerpts, a Verify action (Extract), and a follow-up question box (Responses). Decision buttons and Watch live in the header.

Public demo default: a precomputed canonical run. Live runs require ENABLE_LIVE_RUNS or the passphrase.

## Evals

`evals/labels.json` holds hand labels for the canonical run. `pnpm eval` prints discovery precision, screening agreement, field accuracy, citation coverage, unsupported-claim rate, latency, and cost per candidate and per finalist. Results go in the README.

## Out of scope for V1

Auth, multiple theses per user, thesis editing beyond a text box, PDF export, any valuation logic.
