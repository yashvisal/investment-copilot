/**
 * Task specs for each stage. Field descriptions are the prompt for each field
 * (Parallel best practice). Every field is required; optionals use a null
 * union. No reasoning or confidence fields: Parallel returns those in basis.
 */

export const DEFAULT_THESIS =
  "Find promising early-stage AI infrastructure companies with credible evidence of enterprise adoption and recent momentum, and no massive late-stage financing yet.";

export const DEFAULT_OBJECTIVE_HINT =
  "Private companies building infrastructure for AI systems (inference, training, data, orchestration, evaluation, observability, GPU/compute, vector or retrieval, agent tooling). Seed to Series B. Founded 2020 or later. Evidence of paying enterprise customers or named enterprise deployments. Recent momentum such as funding, launches, or notable hires in the last 12 months.";

const nullableString = (description: string) => ({
  type: ["string", "null"],
  description,
});

const stringArray = (description: string) => ({
  type: "array",
  items: { type: "string" },
  description,
});

/** Screening spec. Runs on `core`. Facts only; classification is our code. */
export const SCREEN_OUTPUT_SCHEMA = {
  type: "object",
  description:
    "Lightweight screen of a private company against an investment thesis. Prefer primary sources (company site, press releases, customer case studies, funding announcements). Return null for any field lacking credible evidence rather than guessing.",
  properties: {
    what_it_sells: nullableString(
      "One or two sentences on the product the company actually sells today and how it is delivered (API, platform, hardware, open source with paid tier). If unclear, return null.",
    ),
    target_customer: nullableString(
      "Who buys it: segment and buyer role, e.g. 'ML platform teams at mid-market and enterprise SaaS companies'. If unclear, return null.",
    ),
    latest_funding_round: nullableString(
      "Most recent disclosed round type, e.g. 'Seed', 'Series A', 'Series B'. If none disclosed, return null.",
    ),
    latest_funding_amount_usd_millions: {
      type: ["number", "null"],
      description:
        "Amount of the most recent round in USD millions as a number, e.g. 25. If undisclosed, return null.",
    },
    latest_funding_date: nullableString(
      "Date of the most recent round in YYYY-MM format. If unknown, return null.",
    ),
    total_raised_usd_millions: {
      type: ["number", "null"],
      description: "Total disclosed funding to date in USD millions. If unknown, return null.",
    },
    enterprise_traction: nullableString(
      "Concrete evidence of enterprise adoption: named customers, case studies, disclosed revenue or ARR, usage numbers, or partnerships with large companies. Quote specifics with dates. If no credible evidence, return null.",
    ),
    recent_momentum: nullableString(
      "Notable events in the last 12 months: funding, product launches, major customer wins, key hires, benchmarks. Include month and year for each. If nothing found, return null.",
    ),
    founded_year: {
      type: ["number", "null"],
      description: "Year founded as a four-digit number. If unknown, return null.",
    },
    thesis_concern: nullableString(
      "Report ONLY a hard disqualifier, and only if credible sources show it: the company was acquired or shut down; it is publicly traded; its latest round is Series C or later or it has raised more than $150M; it primarily sells a consumer product; it is a vertical AI application rather than AI infrastructure; or it is a business unit rather than an independent company. Name which disqualifier applies in the first sentence. Do NOT report weak traction, stale momentum, missing data, or uncertainty here; those belong in the other fields. If no hard disqualifier applies, return null.",
    ),
  },
  required: [
    "what_it_sells",
    "target_customer",
    "latest_funding_round",
    "latest_funding_amount_usd_millions",
    "latest_funding_date",
    "total_raised_usd_millions",
    "enterprise_traction",
    "recent_momentum",
    "founded_year",
    "thesis_concern",
  ],
  additionalProperties: false,
} as const;

export const SCREEN_LABELS: Record<string, string> = {
  what_it_sells: "What it sells",
  target_customer: "Target customer",
  latest_funding_round: "Latest round",
  latest_funding_amount_usd_millions: "Latest round size ($M)",
  latest_funding_date: "Latest round date",
  total_raised_usd_millions: "Total raised ($M)",
  enterprise_traction: "Enterprise traction",
  recent_momentum: "Recent momentum",
  founded_year: "Founded",
  thesis_concern: "Thesis concern",
};

export const SCREEN_INPUT_SCHEMA = {
  type: "object",
  properties: {
    company_name: { type: "string", description: "Company name" },
    company_url: { type: "string", description: "Company website" },
    company_description: { type: "string", description: "Short description from discovery" },
    thesis: { type: "string", description: "The investment thesis being evaluated" },
  },
  required: ["company_name", "company_url", "company_description", "thesis"],
  additionalProperties: false,
} as const;

/** Diligence spec. Runs on `pro`. About 16 fields, within the pro budget. */
export const DILIGENCE_OUTPUT_SCHEMA = {
  type: "object",
  description:
    "Pre-diligence brief on a private company for an early-stage investor evaluating an AI infrastructure thesis. Every claim must be grounded in credible sources; prefer primary sources and reputable press. Where evidence is missing or conflicting, say so explicitly and return null rather than inferring. Cover the last 18 months in detail.",
  properties: {
    product_and_differentiation: nullableString(
      "What the product is, the technical approach, and what concretely differentiates it from alternatives. Three to five sentences.",
    ),
    customers_and_traction: nullableString(
      "Evidence of adoption: named customers, case studies, revenue or ARR figures, usage metrics, growth rates, partnerships. Cite specific figures with dates. Distinguish paying enterprise customers from open-source users.",
    ),
    notable_customers: stringArray(
      "Up to 10 named customers or design partners publicly confirmed by the company or the customer. Empty array if none.",
    ),
    founders_and_team: nullableString(
      "Founders with prior roles and relevant background, plus notable senior hires and approximate headcount.",
    ),
    funding_history: {
      type: "array",
      description: "All disclosed rounds, oldest first.",
      items: {
        type: "object",
        properties: {
          round: { type: "string", description: "Round type, e.g. Seed, Series A" },
          date: { type: ["string", "null"], description: "YYYY-MM or null" },
          amount_usd_millions: { type: ["number", "null"], description: "Amount in USD millions or null" },
          lead_investors: { type: "string", description: "Lead investor names, comma separated, or 'Undisclosed'" },
        },
        required: ["round", "date", "amount_usd_millions", "lead_investors"],
        additionalProperties: false,
      },
    },
    total_raised_usd_millions: {
      type: ["number", "null"],
      description: "Total disclosed funding in USD millions. Null if unknown.",
    },
    latest_valuation_usd_millions: {
      type: ["number", "null"],
      description: "Most recent reported post-money valuation in USD millions. Null if not reported.",
    },
    market: nullableString(
      "The market the company sells into, its size where credibly estimated, and the structural trend driving demand. Note who the budget owner is.",
    ),
    competitors: {
      type: "array",
      description: "Up to 6 closest competitors or substitutes, including incumbents and cloud providers where relevant.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Competitor name" },
          how_it_competes: { type: "string", description: "One sentence on the overlap and how this company positions against it" },
        },
        required: ["name", "how_it_competes"],
        additionalProperties: false,
      },
    },
    recent_momentum: {
      type: "array",
      description: "Up to 8 dated events from the last 18 months: launches, funding, customers, hires, benchmarks, partnerships. Newest first.",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM" },
          event: { type: "string", description: "One sentence" },
        },
        required: ["date", "event"],
        additionalProperties: false,
      },
    },
    bull_case: nullableString(
      "The strongest evidence-backed argument for why this company could become a category leader. Three to four sentences. Only cite things supported by sources.",
    ),
    bear_case: nullableString(
      "The strongest evidence-backed risks: competition from hyperscalers or open source, commoditization, concentration, execution, capital intensity. Three to four sentences.",
    ),
    unresolved_questions: stringArray(
      "Three to six specific questions a human should answer in diligence because the public web cannot, e.g. actual ARR, gross margin, churn, contract structure.",
    ),
    headquarters: nullableString("City and country of headquarters. Null if unknown."),
    founded_year: { type: ["number", "null"], description: "Four-digit founding year or null." },
    employee_count: nullableString(
      "Approximate headcount as a number or range from LinkedIn or press, with the date observed. Null if unknown.",
    ),
  },
  required: [
    "product_and_differentiation",
    "customers_and_traction",
    "notable_customers",
    "founders_and_team",
    "funding_history",
    "total_raised_usd_millions",
    "latest_valuation_usd_millions",
    "market",
    "competitors",
    "recent_momentum",
    "bull_case",
    "bear_case",
    "unresolved_questions",
    "headquarters",
    "founded_year",
    "employee_count",
  ],
  additionalProperties: false,
} as const;

export const DILIGENCE_LABELS: Record<string, string> = {
  product_and_differentiation: "Product and differentiation",
  customers_and_traction: "Customers and traction",
  notable_customers: "Notable customers",
  founders_and_team: "Founders and team",
  funding_history: "Funding history",
  total_raised_usd_millions: "Total raised ($M)",
  latest_valuation_usd_millions: "Latest valuation ($M)",
  market: "Market",
  competitors: "Competition",
  recent_momentum: "Recent momentum",
  bull_case: "Bull case",
  bear_case: "Bear case",
  unresolved_questions: "Unresolved questions",
  headquarters: "Headquarters",
  founded_year: "Founded",
  employee_count: "Employees",
};

/** Section order for the diligence page. */
export const DILIGENCE_SECTIONS: string[] = [
  "product_and_differentiation",
  "customers_and_traction",
  "notable_customers",
  "founders_and_team",
  "funding_history",
  "market",
  "competitors",
  "recent_momentum",
  "bull_case",
  "bear_case",
  "unresolved_questions",
];

export const DILIGENCE_FACTS: string[] = [
  "headquarters",
  "founded_year",
  "employee_count",
  "total_raised_usd_millions",
  "latest_valuation_usd_millions",
];

export function diligenceInput(company: {
  name: string;
  url: string;
  description?: string | null;
  thesis: string;
}): string {
  return [
    `Company: ${company.name} (${company.url})`,
    company.description ? `Known description: ${company.description}` : null,
    `Investor thesis being evaluated: ${company.thesis}`,
    "Produce a pre-diligence brief answering whether this company merits substantial human diligence under that thesis.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Follow-up answers via the Responses API. */
export const FOLLOWUP_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "Direct answer in two to four sentences. If the web does not support an answer, say so plainly." },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence in the answer" },
    evidence_status: {
      type: "string",
      enum: ["supported", "partial", "unknown"],
      description: "supported when multiple credible sources agree; partial when evidence is thin or one-sided; unknown when no credible evidence exists",
    },
  },
  required: ["answer", "confidence", "evidence_status"],
  additionalProperties: false,
} as const;
