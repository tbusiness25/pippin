/*
 * Generic brain: any OpenAI-compatible chat endpoint (Ollama, llama.cpp, OpenAI, OpenRouter…).
 * It only knows what the person tells Pippin (goals, check-ins, chat) — no calendar or email.
 */
const { COACH_PERSONA, planDayPrompt, storyPrompt, parseJson } = require('./prompts');

function openaiClient({ baseUrl, apiKey, model, extraBody = {}, timeoutMs = 120000 }) {
  return async function complete(messages, { json = false } = {}) {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages, stream: false, ...(json && !/^(o\d|gpt-5)/i.test(model) ? { temperature: 0.4 } : {}), ...extraBody }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`brain HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  };
}

function createOpenAIBrain(env) {
  const complete = openaiClient({
    baseUrl: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    // Qwen-style thinking models otherwise leave `content` empty.
    extraBody: env.OPENAI_REASONING_EFFORT ? { reasoning_effort: env.OPENAI_REASONING_EFFORT } : {},
  });
  return {
    name: 'openai',
    label: `${env.OPENAI_MODEL} (generic)`,
    capabilities: { calendar: false, email: false, tasks: false },
    complete,
    async chat(history) {
      return complete([{ role: 'system', content: COACH_PERSONA }, ...history]);
    },
    async planDay(ctx) {
      const prompt = planDayPrompt({
        ...ctx,
        contextInstructions: 'You have no access to their calendar or email. Base the plan on their goals, mood and energy.',
      });
      return parseJson(await complete([{ role: 'system', content: COACH_PERSONA }, { role: 'user', content: prompt }], { json: true }));
    },
    async story(ctx) {
      return parseJson(await complete([{ role: 'user', content: storyPrompt(ctx) }], { json: true }));
    },
  };
}

module.exports = { createOpenAIBrain, openaiClient };
