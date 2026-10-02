/*
 * The coach's ONLY network path: an OpenAI-compatible chat endpoint (COACH_BASE_URL).
 * Requests to any other host are refused in code, so a misconfiguration can't quietly send
 * mental-health conversations somewhere else. Supports tool calling.
 */
const BASE = (process.env.COACH_BASE_URL || '').replace(/\/$/, '');
const MODEL = process.env.COACH_MODEL || '';
const KEY = process.env.COACH_API_KEY || '';
const ALLOWED_HOST = BASE ? new URL(BASE).host : null;

function isLocalHost(host) {
  const h = host.split(':')[0];
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h) || !h.includes('.')
    || h.endsWith('.local') || h === 'host.docker.internal';
}

const configured = () => !!(BASE && MODEL);
const local = () => configured() && isLocalHost(ALLOWED_HOST);

async function chat(messages, { tools, temperature = 0.6, maxTokens = 700 } = {}) {
  if (!configured()) throw new Error('Coach model not configured (COACH_BASE_URL / COACH_MODEL)');
  const url = new URL(`${BASE}/chat/completions`);
  if (url.host !== ALLOWED_HOST) throw new Error('refusing to call a host other than COACH_BASE_URL');
  // OpenAI's newer models want max_completion_tokens, and reasoning models only accept the default temperature.
  const openai = url.host === 'api.openai.com';
  const reasoning = /^(o\d|gpt-5)/i.test(MODEL);
  const body = {
    model: MODEL, messages, stream: false,
    ...(openai ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
    ...(openai && reasoning ? {} : { temperature }),
    ...(process.env.COACH_REASONING_EFFORT ? { reasoning_effort: process.env.COACH_REASONING_EFFORT } : {}),
    ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(parseInt(process.env.COACH_TIMEOUT_MS || '120000', 10)),
  });
  if (!res.ok) throw new Error(`coach model HTTP ${res.status}${res.status === 401 ? ' (check the API key)' : res.status === 404 ? ' (check the model name)' : ''}`);   // never log bodies
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  // Some local models leak <think> blocks into content; strip them.
  if (msg.content) msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return msg;
}

module.exports = { chat, configured, local, label: () => (MODEL ? `${MODEL}${local() ? '' : ' (remote)'}` : 'not configured') };
