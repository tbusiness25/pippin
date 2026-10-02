/*
 * Brain selection. Pippin talks to exactly one interface:
 *   { name, label, capabilities, chat(history), planDay(ctx), story(ctx) }
 * BRAIN=hermes  → Hermes Agent (calendar/email/tasks via its own tools)
 * BRAIN=agent   → any agent with an OpenAI-compatible API (AGENT_API_URL / AGENT_API_KEY / AGENT_MODEL)
 * BRAIN=openai  → any OpenAI-compatible model (in-app context only)
 * STORY_* optionally points adventure stories at a small fast model; otherwise the main brain writes them.
 * If no brain is configured, Pippin still works: stories come from built-in templates.
 */
const { createOpenAIBrain } = require('./openai');
const { createHermesBrain } = require('./hermes');
const { storyPrompt, parseJson } = require('./prompts');
const { openaiClient } = require('./openai');

function templateStory({ petName, place }) {
  const finds = ['a very round pebble', 'a leaf shaped like a heart', 'a snail who knew the way home',
    'a button nobody had missed yet', 'a feather with a stripe', 'a puddle that reflected two moons'];
  const qs = ['What made you smile today?', 'What would feel kind right now?', 'Who would you like to see this week?'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const find = pick(finds);
  return {
    title: `A day at ${place.replace(/^the /, '')}`,
    story: `${petName} set off for ${place} with a snack and a good feeling. It took the long way round, on purpose. ` +
           `At the end of the path, ${petName} found ${find} and decided it was a sign of something nice.`,
    discovery: find,
    question: pick(qs),
  };
}

function createBrain(env) {
  let story = async (ctx) => templateStory(ctx);
  if (env.STORY_BASE_URL && env.STORY_MODEL) {
    const complete = openaiClient({
      baseUrl: env.STORY_BASE_URL, apiKey: env.STORY_API_KEY, model: env.STORY_MODEL, timeoutMs: 60000,
      extraBody: env.STORY_REASONING_EFFORT ? { reasoning_effort: env.STORY_REASONING_EFFORT } : {},
    });
    story = async (ctx) => {
      try { return parseJson(await complete([{ role: 'user', content: storyPrompt(ctx) }], { json: true })); }
      catch (e) { console.warn('[story] model failed, using template:', e.message); return templateStory(ctx); }
    };
  }

  const kind = (env.BRAIN || '').toLowerCase();
  if (kind === 'agent' && env.AGENT_API_URL) {
    return createHermesBrain({ ...env, HERMES_API_URL: env.AGENT_API_URL, HERMES_API_KEY: env.AGENT_API_KEY,
      HERMES_MODEL: env.AGENT_MODEL || 'agent', HERMES_CONTEXT_HINT: env.AGENT_CONTEXT_HINT || env.HERMES_CONTEXT_HINT }, story, 'Your agent');
  }
  if (kind === 'hermes' && env.HERMES_API_URL) return createHermesBrain(env, story);
  if (kind === 'openai' && env.OPENAI_BASE_URL && env.OPENAI_MODEL) {
    const b = createOpenAIBrain(env);
    if (env.STORY_BASE_URL) b.story = story;
    else { const s = b.story; b.story = async (ctx) => { try { return await s(ctx); } catch { return templateStory(ctx); } }; }
    return b;
  }
  return {
    name: 'none', label: 'No coach configured', capabilities: {},
    async chat() { return 'No coach brain is configured yet — set BRAIN in .env (see README).'; },
    async planDay() { throw new Error('No coach brain configured'); },
    story,
  };
}

module.exports = { createBrain, templateStory };
