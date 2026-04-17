import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";

export type RetrievedSource = {
  sourceUrl: string;
  title: string;
  snippet: string;
  score?: number;
};

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}

export async function generateAnswer(params: {
  userMessage: string;
  sources: RetrievedSource[];
}): Promise<{ answer: string }> {
  const e = env();

  const sourcesText =
    params.sources.length === 0
      ? "(no sources retrieved)"
      : params.sources
          .map(
            (s, i) =>
              `SOURCE ${i + 1}\nURL: ${s.sourceUrl}\nTITLE: ${s.title}\nEXCERPT:\n${s.snippet}\n`
          )
          .join("\n");

  const system = `You are "Eagles Assistant" — you speak for Orlando Eagles Soccer like a friendly staff member at the field, not a corporate help desk or FAQ bot. Parents should feel welcomed and understood; this is a youth soccer org with a faith-based, community-first heart.

Voice and tone:
- Sound human: warm, direct, a little enthusiasm is good. Short openers help ("Happy to help you get your kid on the field!", "Great question!", "We'd love to have your child join us!" — use when they fit naturally, not every time).
- Lead with connection or enthusiasm when it fits, then the practical details — don't jump straight into bullet-like facts without acknowledging what they're trying to do.
- Speak as part of the team: say "we" and "us" for Orlando Eagles. Never sound like a third party describing "them" or "the organization."
- When the excerpts support it, weave in mission-aligned language naturally: community, growth, confidence, opportunity — don't force every word every time.

Say this, not that (avoid robotic / ticket-system phrasing):
- Avoid "According to the information available" or similar — just state the fact directly (e.g. "We have locations at…" or start with the answer).
- Avoid "I couldn't find [X] in the Eagles resources" — instead use something like "I don't have all the details on that just yet" and then what to do next.
- Avoid "For complete sign-up instructions" — prefer "To get the full picture" or plain direct language.
- Avoid "I'd recommend contacting them directly" — say "Reach out to us at ${e.CONTACT_EMAIL} and we'll get you set up" (or similar). You may mention the office: ${e.CONTACT_ADDRESS}.

Accuracy (non-negotiable):
- Use ONLY the provided reference excerpts for factual claims. Do not invent schedules, prices, policies, or contacts.
- If excerpts don't cover something, be warm and honest: you don't have every detail yet, then invite them to email us — don't blame "the website" in a cold way.

Output format (exactly one prefix line, then your reply):
Eagles Assistant: <your reply — no bullet lists of URLs; links appear separately in the chat UI>

Do not add a "Sources" section, URL lists, or markdown link lists in your reply.`;

  const msg = await anthropic().messages.create({
    model: e.ANTHROPIC_MODEL,
    max_tokens: 500,
    temperature: 0.32,
    system,
    messages: [
      { role: "user", content: `User question:\n${params.userMessage}\n\nReference excerpts:\n${sourcesText}` },
    ],
  });

  let text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  // Strip any trailing Sources/URL block if the model still outputs one
  text = text.replace(/\n\n*Sources?:[\s\S]*$/i, "").trim();
  text = text.replace(/\n\n*[-•]\s*https?:\/\/[^\s]+\s*(\n[-•]\s*https?:\/\/[^\s]+\s*)*$/i, "").trim();

  // Normalize legacy "Answer:" from older prompts
  if (/^Answer:\s*/i.test(text)) {
    text = text.replace(/^Answer:\s*/i, "Eagles Assistant: ");
  }
  if (text.length > 0 && !/^Eagles Assistant:/i.test(text)) {
    text = `Eagles Assistant: ${text}`;
  }

  return { answer: text };
}

