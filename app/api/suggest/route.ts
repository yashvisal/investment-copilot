import OpenAI from "openai";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

const INSTRUCTIONS = [
  "You write one-sentence venture investment theses for a sourcing tool that finds early-stage companies on the open web.",
  "Return exactly one sentence, 18 to 30 words, starting with the word Find, no quotes, no preamble.",
  "The thesis is a demo input, so it must be easy to satisfy: at least 40 well-covered startups should fit every clause, so a search can comfortably return 25 or more matches.",
  "Structure: a broad, widely covered software sector, one soft traction signal, and one loose stage phrase. That is all. Three clauses maximum.",
  "Every clause must be lenient. Say 'signs of' or 'early' rather than 'proven' or 'evidence of'. Never require paying customers, enterprise deployments, hiring, named investors, round names, revenue numbers, or headcount.",
  "Use the sector and evidence signal you are given. Do not swap them for another sector.",
  "Register to match, but do not copy its wording: Find promising early-stage AI infrastructure companies with credible evidence of enterprise adoption and recent momentum, and no massive late-stage financing yet.",
].join(" ");

/* The server picks the ingredients so a reasoning-free model still varies the output. */
const SECTORS = [
  "AI infrastructure",
  "developer tools",
  "cybersecurity",
  "fintech infrastructure",
  "healthcare software",
  "climate software",
  "data infrastructure",
  "AI agents for enterprises",
  "B2B SaaS for finance teams",
  "legal technology",
  "supply chain software",
  "HR and payroll software",
  "security for AI systems",
  "sales and marketing automation",
  "insurance technology",
  "AI for customer support",
  "observability and DevOps",
  "AI coding tools",
];

const SIGNALS = [
  "early signs of customer traction",
  "signs of recent momentum",
  "a live product with real users",
  "some early commercial adoption",
  "signs of growing adoption",
];

const STAGES = [
  "no massive late-stage financing yet",
  "still early-stage",
  "not yet at growth stage",
];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

/** Streams a fresh thesis as plain text so the box fills in as it is written. */
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("OPENAI_API_KEY is not set", { status: 500 });
  const { avoid } = (await req.json().catch(() => ({}))) as { avoid?: string };
  const openai = new OpenAI({ apiKey });

  const stream = await openai.responses.create({
    model: MODEL,
    reasoning: { effort: "none" },
    instructions: INSTRUCTIONS,
    input: [
      `Sector: ${pick(SECTORS.filter((s) => !avoid?.toLowerCase().includes(s.toLowerCase())))}.`,
      `Evidence signal: ${pick(SIGNALS)}.`,
      `Stage constraint: ${pick(STAGES)}.`,
      avoid ? `Do not reuse the wording of this earlier thesis: ${avoid}` : "",
      "Write the thesis.",
    ]
      .filter(Boolean)
      .join(" "),
    stream: true,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") controller.enqueue(encoder.encode(event.delta));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n[error] ${e instanceof Error ? e.message : String(e)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
