/*
 * Shared helpers for the kids' modules and the Family section.
 *  - kidsLlm(messages)   : the model kids' features use (KIDS_LLM_URL / KIDS_LLM_MODEL, OpenAI-compatible).
 *                          Deliberately separate from the adult coach model and from any agent: no tools, no web.
 *                          Local network only unless KIDS_LLM_ALLOW_CLOUD=true (see llmGuard.js).
 *  - transcribe(buf,mime): local Whisper (WHISPER_URL).
 *  - alertParents(text)  : web push to every parent, plus an optional Telegram message (ALERT_TELEGRAM_*).
 *  - dataDir(...parts)   : where kids' files live (KIDS_DATA_DIR, default /data/kids).
 *  - childDir(child)     : a child's own folder for audio etc. (/data/kids/<id>/…).
 *  - audit(uid, event, payload): append-only family audit log (kid_audit).
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const llmGuard = require('./llmGuard');

const DATA = process.env.KIDS_DATA_DIR || '/data/kids';
const dataDir = (...p) => path.join(DATA, ...p);
const childDir = (child, ...p) => path.join(DATA, String(child.id || child), ...p);
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };

const LLM_URL = (process.env.KIDS_LLM_URL || process.env.STORY_BASE_URL || '').replace(/\/$/, '');
const LLM_MODEL = process.env.KIDS_LLM_MODEL || process.env.STORY_MODEL || '';
const LLM_KEY = process.env.KIDS_LLM_API_KEY || '';
const llmConfigured = () => !!(LLM_URL && LLM_MODEL);
if (LLM_URL && !llmGuard.kidsLlmUrlAllowed(LLM_URL)) {
  console.warn(`[kids-llm] the children’s model URL is not on your network, so kids' features will refuse to call it: ${LLM_URL.replace(/\/\/[^@/]*@/, '//')}`);
}

async function kidsLlm(messages, { maxTokens = 600, temperature = 0.6, json = false, model, timeoutMs = 120000 } = {}) {
  if (!llmConfigured()) throw new Error('KIDS_LLM_URL / KIDS_LLM_MODEL not configured');
  llmGuard.assertKidsLlmUrl(LLM_URL);   // refuses before anything is sent
  const r = await fetch(`${LLM_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(LLM_KEY ? { Authorization: `Bearer ${LLM_KEY}` } : {}) },
    body: JSON.stringify({ model: model || LLM_MODEL, messages, stream: false, max_tokens: maxTokens, temperature,
      ...(process.env.KIDS_LLM_REASONING_EFFORT ? { reasoning_effort: process.env.KIDS_LLM_REASONING_EFFORT } : {}),
      ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',   // a redirect could send the children's text to another host
  });
  if (!r.ok) throw new Error(`kids model HTTP ${r.status}`);
  const d = await r.json();
  return String(d.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

async function transcribe(buf, mime = 'audio/webm') {
  if (!process.env.WHISPER_URL) throw new Error('voice not set up');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), `speech.${(mime.split('/')[1] || 'webm').split(';')[0]}`);
  form.append('model', process.env.WHISPER_MODEL || 'whisper-1');
  form.append('language', 'en');
  const r = await fetch(`${process.env.WHISPER_URL.replace(/\/$/, '')}/audio/transcriptions`, { method: 'POST', body: form, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`whisper ${r.status}`);
  return String((await r.json()).text || '').trim();
}

async function parents() {
  const { rows } = await pool.query(`SELECT id, name FROM users WHERE is_parent AND role='adult' AND deleted_at IS NULL`);
  return rows;
}

async function alertParents(text, { tag = 'kids', url = '/#family' } = {}) {
  const push = require('../push');
  for (const p of await parents()) push.notify(p.id, tag, text, { ref: `${tag}:${Date.now()}`, url, force: true }).catch(() => {});
  const tok = process.env.ALERT_TELEGRAM_BOT_TOKEN, chat = process.env.ALERT_TELEGRAM_CHAT_ID;
  if (tok && chat) {
    fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 3900) }), signal: AbortSignal.timeout(15000) }).catch(() => {});
  }
}

async function audit(uid, event, payload = {}) {
  await pool.query('INSERT INTO kid_audit(user_id, event, payload) VALUES ($1,$2,$3)', [uid, event, payload]).catch(() => {});
}

const localDate = (tz = process.env.TZ_DEFAULT || 'Europe/London', d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

module.exports = { kidsLlm, llmConfigured, kidsLlmUrlAllowed: llmGuard.kidsLlmUrlAllowed, assertKidsLlmUrl: llmGuard.assertKidsLlmUrl, transcribe, alertParents, parents, dataDir, childDir, ensureDir, audit, localDate, DATA };
