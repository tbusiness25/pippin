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

/*
 * Per-person brains. The server's default brain (BRAIN=…) belongs to the OWNER. Other people can be given
 * their own agent with named profiles in .env:
 *   AGENT_PROFILES=partner
 *   AGENT_PARTNER_URL=http://their-agent:8642/v1   AGENT_PARTNER_KEY=…   AGENT_PARTNER_MODEL=hermes
 *   AGENT_PARTNER_LABEL=Hermes                      AGENT_PARTNER_KIND=hermes   (hermes | agent)
 * and users.brain = 'partner'. users.brain = 'none' turns the agent off for someone; NULL means the default
 * brain for the owner and no agent for anyone else (so a new household member never borrows the owner's agent).
 */
const { pool } = require('../db');

function agentProfiles(env) {
  const out = {};
  const raw = (env.BRAIN || '').toLowerCase();
  if ((raw === 'hermes' && env.HERMES_API_URL) || (raw === 'agent' && env.AGENT_API_URL)) {
    out.default = { url: raw === 'hermes' ? env.HERMES_API_URL : env.AGENT_API_URL,
      key: raw === 'hermes' ? env.HERMES_API_KEY : env.AGENT_API_KEY,
      model: (raw === 'hermes' ? env.HERMES_MODEL : env.AGENT_MODEL) || 'agent',
      label: env.AGENT_DEFAULT_LABEL || (raw === 'hermes' ? 'Hermes' : 'Your agent'),
      kind: raw === 'hermes' ? 'hermes' : (env.AGENT_DEFAULT_KIND || 'agent') };
  }
  for (const name of (env.AGENT_PROFILES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const P = `AGENT_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_`;
    if (!env[`${P}URL`]) { console.warn(`[brain] profile "${name}" has no ${P}URL — skipped`); continue; }
    out[name] = { url: env[`${P}URL`], key: env[`${P}KEY`] || '', model: env[`${P}MODEL`] || 'agent',
      label: env[`${P}LABEL`] || 'Your agent', kind: (env[`${P}KIND`] || 'agent').toLowerCase(),
      hint: env[`${P}CONTEXT_HINT`] || '' };
  }
  return out;
}

function createBrains(env) {
  const base = createBrain(env);
  const none = { name: 'none', label: 'No agent connected', capabilities: {}, story: base.story,
    async chat() { return 'No agent is connected for you.'; }, async planDay() { throw new Error('No agent connected for you'); } };
  const profiles = agentProfiles(env);
  const cache = { none };
  const make = (name) => {
    if (cache[name]) return cache[name];
    const p = profiles[name];
    if (!p) return none;
    const b = name === 'default' && base.name !== 'none' ? base
      : createHermesBrain({ ...env, HERMES_API_URL: p.url, HERMES_API_KEY: p.key, HERMES_MODEL: p.model,
        HERMES_CONTEXT_HINT: p.hint || '' }, base.story, p.label);
    b.profile = name;
    b.agent = p;
    return (cache[name] = b);
  };
  async function forUser(uid) {
    const { rows: [u] } = await pool.query('SELECT brain, is_owner, role FROM users WHERE id=$1', [uid]);
    if (!u || u.role === 'child') return none;
    const name = (u.brain || (u.is_owner ? 'default' : 'none')).toLowerCase();
    return make(name);
  }
  return { default: base, none, forUser, profiles: Object.keys(profiles), profile: (n) => profiles[n] || null, story: base.story };
}

module.exports = { createBrain, createBrains, templateStory, agentProfiles };
