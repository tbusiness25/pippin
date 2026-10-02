/*
 * Configuration bootstrap — runs before anything else reads process.env.
 *  1. Loads .env when running without Docker (Docker passes it in already). Real env vars always win.
 *  2. Expands the simple AI settings (AI_PROVIDER / AI_API_KEY / AI_MODEL) into the per-feature ones
 *     (COACH_*, OPENAI_* for the day-planner brain, chat), unless those are set explicitly.
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv(file = path.join(__dirname, '..', '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    process.env[m[1]] = v;
  }
}

// OpenAI-compatible endpoints for the common providers. Anthropic, Gemini and OpenRouter all offer one.
const PROVIDERS = {
  ollama:     { base: 'http://host.docker.internal:11434/v1', model: '', key: false },
  openai:     { base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', key: true },
  anthropic:  { base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5', key: true },
  openrouter: { base: 'https://openrouter.ai/api/v1', model: '', key: true },
  gemini:     { base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', key: true },
  custom:     { base: '', model: '', key: false },
};

function applyProvider(env = process.env) {
  const name = (env.AI_PROVIDER || '').toLowerCase().trim();
  if (!name) return null;
  const p = PROVIDERS[name];
  if (!p) { console.warn(`[config] unknown AI_PROVIDER "${name}" — use one of ${Object.keys(PROVIDERS).join(', ')}`); return null; }
  const base = env.AI_BASE_URL || p.base;
  const model = env.AI_MODEL || p.model;
  const key = env.AI_API_KEY || '';
  if (!base || !model) { console.warn('[config] AI_PROVIDER is set but AI_BASE_URL / AI_MODEL is missing'); return null; }
  if (p.key && !key) console.warn(`[config] AI_PROVIDER=${name} needs AI_API_KEY`);
  const set = (k, v) => { if (!env[k] && v) env[k] = v; };
  set('COACH_BASE_URL', base); set('COACH_MODEL', model); set('COACH_API_KEY', key);
  if (!env.BRAIN) env.BRAIN = 'openai';
  // "reasoning_effort: none" is an Ollama/Qwen switch; cloud APIs reject it on most models.
  if (p.key) for (const k of ['COACH_REASONING_EFFORT', 'OPENAI_REASONING_EFFORT']) if (env[k] === 'none') delete env[k];
  set('OPENAI_BASE_URL', base); set('OPENAI_MODEL', model); set('OPENAI_API_KEY', key);
  return { name, base, model };
}

loadDotEnv();
const provider = applyProvider();
module.exports = { provider, PROVIDERS, applyProvider, loadDotEnv };
