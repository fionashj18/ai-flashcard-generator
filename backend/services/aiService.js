const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateFlashcards(text) {
  const prompt = `You are a study assistant. Read the lecture content below and create flashcards.

Return ONLY a valid JSON array — no markdown, no explanation. Each item must have this shape:
{ "question": "...", "answer": "..." }

Make 8-15 flashcards covering the key concepts. Questions should test understanding, not just recall.

Lecture content:
"""
${text}
"""`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].text.trim();

  // Strip markdown code fences if Claude wrapped the JSON in them
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

  return JSON.parse(cleaned);
}

module.exports = { generateFlashcards };
