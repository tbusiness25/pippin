/*
 * Agent chat: talk to YOUR OWN agent from the Talk tab (the agent set by users.brain — see src/brains).
 *
 * Two kinds of agent:
 *  - kind=hermes : a Hermes Agent API server. Conversations live in the agent as sessions, so chats you had
 *                  elsewhere (its own apps, Telegram…) show up here too. Streams via
 *                  POST /api/sessions/{id}/chat/stream (SSE: assistant.delta, tool.started/completed, assistant.completed).
 *  - kind=agent  : any OpenAI-compatible endpoint. Conversations are kept by this app (chat_threads with
 *                  engine='agent', messages encrypted like the rest of chat) and streamed from /chat/completions.
 *
 * The agent has its own tools and memory; this app just relays text. Nothing here ever goes to another
 * person's agent: the profile is looked up from the signed-in person on every request.
 */
const { pool } = require('../db');
const { encrypt, decrypt } = require('../coach/crypto');

const rootOf = (url) => String(url || '').replace(/\/+$/, '').replace(/\/v1$/, '');
const SAFE_ID = /^[\w.:-]{1,120}$/;
const HIDDEN_SOURCES = new Set(['cron', 'system', 'subagent', 'delegate']);

function headers(p, extra = {}) {
  return { 'Content-Type': 'application/json', ...(p.key ? { Authorization: `Bearer ${p.key}` } : {}), ...extra };
}
async function call(p, path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  const r = await fetch(`${rootOf(p.url)}${path}`, { method, headers: headers(p), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!r.ok) throw new Error(`agent HTTP ${r.status}${data?.error?.message ? `: ${String(data.error.message).slice(0, 120)}` : ''}`);
  return data;
}

const toIso = (t) => (typeof t === 'number' ? new Date(t * 1000).toISOString() : t || null);

// ---------- conversations ----------
async function list(uid, p) {
  if (p.kind === 'hermes') {
    const d = await call(p, '/api/sessions?limit=60');
    return (d?.data || []).filter((s) => !HIDDEN_SOURCES.has(s.source) && (s.message_count || 0) > 0).map((s) => ({
      id: s.id, title: s.title || (s.preview ? String(s.preview).slice(0, 60) : 'Chat'), updated_at: toIso(s.last_active || s.started_at),
      source: s.source && s.source !== 'api_server' ? s.source : null }));
  }
  const { rows } = await pool.query(`SELECT id, title, updated_at FROM chat_threads WHERE user_id=$1 AND engine='agent' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`, [uid]);
  return rows;
}

async function create(uid, p) {
  if (p.kind === 'hermes') {
    const d = await call(p, '/api/sessions', { method: 'POST', body: {} });
    const id = d?.session?.id || d?.id || d?.session_id || d?.data?.id;
    if (!id) throw new Error('agent did not return a session id');
    return { id, title: 'New chat' };
  }
  const { rows } = await pool.query(`INSERT INTO chat_threads(user_id, engine) VALUES ($1,'agent') RETURNING id, title`, [uid]);
  return rows[0];
}

async function messages(uid, p, id) {
  if (p.kind === 'hermes') {
    if (!SAFE_ID.test(id)) throw new Error('bad id');
    const [meta, d] = await Promise.all([call(p, `/api/sessions/${encodeURIComponent(id)}`).catch(() => null),
      call(p, `/api/sessions/${encodeURIComponent(id)}/messages?limit=300&order=oldest`)]);
    const out = [];
    for (const m of d?.data || []) {
      if (m.role === 'tool') { out.push({ role: 'tool', content: m.tool_name || 'tool' }); continue; }
      if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length && !m.content) {
        out.push({ role: 'tool', content: m.tool_calls.map((t) => t.function?.name || t.name || 'tool').join(', ') }); continue;
      }
      if ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) {
        out.push({ role: m.role, content: m.content, created_at: toIso(m.timestamp) });
      }
    }
    const s = meta?.session || meta?.data || meta || {};
    return { thread: { id, title: s.title || (s.preview ? String(s.preview).slice(0, 60) : 'Chat') }, messages: out };
  }
  const { rows: [t] } = await pool.query(`SELECT id, title FROM chat_threads WHERE id=$1 AND user_id=$2 AND engine='agent' AND deleted_at IS NULL`, [id, uid]);
  if (!t) return null;
  const { rows } = await pool.query(`SELECT role, body_enc, created_at FROM coach_messages WHERE thread_id=$1 ORDER BY id`, [id]);
  return { thread: t, messages: rows.map((r) => { try { return { role: r.role, content: decrypt(r.body_enc), created_at: r.created_at }; } catch { return null; } }).filter(Boolean) };
}

async function rename(uid, p, id, title) {
  title = String(title || 'Chat').slice(0, 60);
  if (p.kind === 'hermes') { if (!SAFE_ID.test(id)) return; await call(p, `/api/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title } }); return; }
  await pool.query(`UPDATE chat_threads SET title=$3 WHERE id=$1 AND user_id=$2 AND engine='agent'`, [id, uid, title]);
}

async function remove(uid, p, id) {
  if (p.kind === 'hermes') { if (!SAFE_ID.test(id)) return; await call(p, `/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }); return; }
  await pool.query(`UPDATE chat_threads SET deleted_at=NOW() WHERE id=$1 AND user_id=$2 AND engine='agent'`, [id, uid]);
  await pool.query('DELETE FROM coach_messages WHERE thread_id=$1 AND user_id=$2', [id, uid]);
}

// ---------- streaming a turn ----------
/** Parse an SSE byte stream into {event, data} objects. */
async function* sse(body) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
      let event = 'message'; const data = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (data.length) yield { event, data: data.join('\n') };
    }
  }
}

/**
 * Send one message and stream the answer. `emit(type, payload)` is called with
 *   delta {text} · tool {name, phase: start|done|failed} · done {text, title?} · error {message}
 */
async function send(uid, p, id, text, emit, { signal } = {}) {
  const timeout = AbortSignal.timeout(parseInt(process.env.AGENT_CHAT_TIMEOUT_MS || '600000', 10));
  const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
  if (p.kind === 'hermes') {
    if (!SAFE_ID.test(id)) throw new Error('bad id');
    const r = await fetch(`${rootOf(p.url)}/api/sessions/${encodeURIComponent(id)}/chat/stream`, {
      method: 'POST', headers: headers(p, { Accept: 'text/event-stream' }), body: JSON.stringify({ message: text }), signal: sig });
    if (!r.ok) throw new Error(`agent HTTP ${r.status}`);
    let full = '';
    for await (const ev of sse(r.body)) {
      let d = {}; try { d = JSON.parse(ev.data); } catch (_) { continue; }
      const name = ev.event !== 'message' ? ev.event : d.type || d.event;
      if (name === 'assistant.delta' && d.delta) { full += d.delta; emit('delta', { text: d.delta }); }
      else if (name === 'tool.started') emit('tool', { name: d.tool_name || 'tool', phase: 'start' });
      else if (name === 'tool.completed') emit('tool', { name: d.tool_name || 'tool', phase: 'done' });
      else if (name === 'tool.failed') emit('tool', { name: d.tool_name || 'tool', phase: 'failed' });
      else if (name === 'assistant.completed') { full = typeof d.content === 'string' && d.content ? d.content : full; }
      else if (name === 'run.failed' || name === 'error') throw new Error(d.message || d.error?.message || 'the agent hit an error');
    }
    emit('done', { text: full.trim() || '…' });
    return;
  }
  // Generic OpenAI-compatible agent: history from our own encrypted store.
  const t = await messages(uid, p, id);
  if (!t) throw new Error('no such chat');
  const hist = t.messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-30).map((m) => ({ role: m.role, content: m.content }));
  await pool.query('INSERT INTO coach_messages(user_id, role, body_enc, thread_id) VALUES ($1,$2,$3,$4)', [uid, 'user', encrypt(text), id]);
  const r = await fetch(`${String(p.url).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST', headers: headers(p, { Accept: 'text/event-stream' }), signal: sig,
    body: JSON.stringify({ model: p.model, stream: true, messages: [...hist, { role: 'user', content: text }] }) });
  if (!r.ok) throw new Error(`agent HTTP ${r.status}`);
  let full = '';
  for await (const ev of sse(r.body)) {
    if (ev.data === '[DONE]') break;
    let d = {}; try { d = JSON.parse(ev.data); } catch (_) { continue; }
    if (ev.event === 'hermes.tool.progress') { emit('tool', { name: d.tool_name || d.tool || 'tool', phase: 'start' }); continue; }
    const delta = d.choices?.[0]?.delta?.content;
    if (delta) { full += delta; emit('delta', { text: delta }); }
  }
  full = full.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '…';
  await pool.query('INSERT INTO coach_messages(user_id, role, body_enc, thread_id) VALUES ($1,$2,$3,$4)', [uid, 'assistant', encrypt(full), id]);
  let title = null;
  if (t.thread.title === 'New chat') {
    title = text.replace(/\s+/g, ' ').slice(0, 50);
    await pool.query('UPDATE chat_threads SET title=$2 WHERE id=$1', [id, title]);
  }
  await pool.query('UPDATE chat_threads SET updated_at=NOW() WHERE id=$1', [id]);
  emit('done', { text: full, title });
}

module.exports = { list, create, messages, rename, remove, send, rootOf };
