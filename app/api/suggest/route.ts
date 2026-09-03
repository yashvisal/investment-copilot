import OpenAI from "openai";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

const INSTRUCTIONS = [
  "You write one-sentence venture investment theses for a sourcing tool that finds early-stage companies on the open web.",
  "Return exactly one sentence, 20 to 35 words, no quotes, no preamble.",
  "It must name a concrete sector, an evidence requirement (traction, customers, hiring, product signals), and one stage or financing constraint.",
  "Pick a sector at random from across the whole economy: climate, biotech, fintech, defense, logistics, construction, education, robotics, consumer, health, energy, agriculture, space, developer tools, legal, insurance, manufacturing, media.",
  "Example of the register: Find promising early-stage AI infrastructure companies with credible evidence of enterprise adoption and recent momentum, and no massive late-stage financing yet.",
].join(" ");

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
    input: avoid ? `Write a different thesis. Do not reuse this sector or wording: ${avoid}` : "Write a thesis.",
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
