/*
 * General AI chat — everyday questions, writing, planning, ideas. Separate conversations from the private coach.
 * Same local model, same deterministic crisis screen, same encryption. It MAY use web search
 * (SearXNG) and read public web pages if CHAT_WEB=true — that is the only path where text leaves the
 * network (search terms + page addresses), and the UI says so. The coach conversation never uses these tools.
 */
const { APP_NAME } = require('../brand');
const dns = require('dns').promises;
const net = require('net');
const { pool } = require('../db');
const game = require('../game');
const llm = require('./llm');
const crisis = require('./crisis');
const { encrypt, decrypt } = require('./crypto');

const WEB = process.env.CHAT_WEB === 'true' && !!process.env.SEARXNG_URL;
const HISTORY = 20;

const PERSONA = (name) => `You are a helpful, friendly general assistant inside ${APP_NAME}, ${name}'s private app.
Answer clearly and concisely in British English. Use short paragraphs or bullets. Be honest when unsure.
${WEB ? 'You can search the web (web_search) and read pages (read_page) for anything current, local or factual you are unsure of — cite the sites you used as plain links at the end.' : 'You have no internet access; say so if a question needs current information.'}
You can also add things to their to-do inbox (add_to_inbox) if they ask.
You are not a therapist or doctor. For ADHD support, planning their day or how they're feeling, suggest the Coach tab.
Never give medication dosing, diet/calorie plans or self-harm method information.`;

// ---------- web tools (SSRF-safe) ----------
function isPrivate(ip) {
  if (net.isIPv6(ip)) return /^(::1|fc|fd|fe80|::ffff:(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.))/i.test(ip) || ip === '::';
  return /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/.test(ip);
}
async function safeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('not a valid address'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http(s) pages');
  if (!u.hostname.includes('.') || /\.(local|lan|internal|home|ts\.net)$/i.test(u.hostname)) throw new Error('internal addresses are not allowed');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('internal addresses are not allowed');
  return u;
}
async function fetchPublic(raw, depth = 0) {
  const u = await safeUrl(raw);
  const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (page reader)', Accept: 'text/html,text/plain' }, signal: AbortSignal.timeout(15000) });
  if (r.status >= 300 && r.status < 400 && r.headers.get('location') && depth < 3) return fetchPublic(new URL(r.headers.get('location'), u).toString(), depth + 1);
  if (!r.ok) throw new Error(`page returned ${r.status}`);
  const html = (await r.text()).slice(0, 2_000_000);
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const text = html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { url: u.toString(), title: title.trim().slice(0, 200), text: text.slice(0, 10000) };
}
async function webSearch(q) {
  const url = `${process.env.SEARXNG_URL.replace(/\/$/, '')}/search?format=json&language=en-GB&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`search ${r.status}`);
  const d = await r.json();
  return (d.results || []).slice(0, 8).map((x) => ({ title: x.title, url: x.url, snippet: (x.content || '').slice(0, 300) }));
}

const TOOLS = [
  ...(WEB ? [
    { type: 'function', function: { name: 'web_search', description: 'Search the web. Use for anything current, local, or factual you are not sure of.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'read_page', description: 'Read the text of a public web page (from search results).', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  ] : []),
  { type: 'function', function: { name: 'add_to_inbox', description: 'Add a to-do to their inbox.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
];

async function runTool(uid, name, args, out) {
  if (name === 'web_search' && WEB) { const r = await webSearch(String(args.query || '').slice(0, 200)); out.sources.push(...r.slice(0, 3).map((x) => x.url)); return { results: r }; }
  if (name === 'read_page' && WEB) { const r = await fetchPublic(String(args.url || '')); return r; }
  if (name === 'add_to_inbox') {
    await pool.query('INSERT INTO inbox_items(user_id, text) VALUES ($1,$2)', [uid, String(args.text || '').slice(0, 300)]);
    out.actions.push({ type: 'inbox', text: args.text });
    return { saved: true };
  }
  return { error: 'unknown tool' };
}

async function ownThread(uid, threadId) {
  const { rows } = await pool.query('SELECT * FROM chat_threads WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [threadId, uid]);
  return rows[0] || null;
}

async function turn(uid, threadId, text) {
  const out = { reply: '', crisis: null, actions: [], sources: [], web: WEB };
  const t = await ownThread(uid, threadId);
  if (!t) throw new Error('no such chat');
  const level = crisis.screen(text);
  if (level) { out.crisis = { level, resources: crisis.resources(level) }; await pool.query('INSERT INTO crisis_events(user_id, level) VALUES ($1,$2)', [uid, level]); }
  const user = await game.getUser(uid);
  const { rows } = await pool.query(
    `SELECT role, body_enc FROM (SELECT * FROM coach_messages WHERE thread_id=$1 ORDER BY id DESC LIMIT $2) m ORDER BY id`, [threadId, HISTORY]);
  const history = rows.map((r) => { try { return { role: r.role, content: decrypt(r.body_enc) }; } catch { return null; } }).filter((m) => m && m.role !== 'event');
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: user.tz, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  const sys = `${PERSONA(user.name || 'the person')}\nToday is ${now}.${level ? `\n${crisis.MODEL_GUIDANCE[level === 'medical' ? 'medical' : level]}` : ''}`;
  const msgs = [{ role: 'system', content: sys }, ...history, { role: 'user', content: text }];
  await pool.query('INSERT INTO coach_messages(user_id, role, body_enc, thread_id) VALUES ($1,$2,$3,$4)', [uid, 'user', encrypt(text), threadId]);
  for (let round = 0; round <= 5; round++) {
    const m = await llm.chat(msgs, { tools: level === 'high' || level === 'medical' ? [] : TOOLS, maxTokens: 1200 });
    if (m.tool_calls?.length && round < 5) {
      msgs.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
      for (const tc of m.tool_calls) {
        let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
        let result; try { result = await runTool(uid, tc.function.name, args, out); } catch (e) { result = { error: e.message }; }
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 12000) });
      }
      continue;
    }
    out.reply = (m.content || '').trim() || 'Sorry — I didn’t get an answer there. Try asking another way?';
    break;
  }
  await pool.query('INSERT INTO coach_messages(user_id, role, body_enc, thread_id) VALUES ($1,$2,$3,$4)', [uid, 'assistant', encrypt(out.reply), threadId]);
  await pool.query('UPDATE chat_threads SET updated_at=NOW() WHERE id=$1', [threadId]);
  // Name the chat after its first exchange.
  if (t.title === 'New chat') {
    try {
      const m = await llm.chat([{ role: 'user', content: `Give a 2-5 word title for a chat that starts: "${text.slice(0, 300)}". Reply with the title only.` }], { maxTokens: 20, temperature: 0.3 });
      const title = (m.content || '').replace(/["'*#]/g, '').trim().slice(0, 60);
      if (title) { await pool.query('UPDATE chat_threads SET title=$2 WHERE id=$1', [threadId, title]); out.title = title; }
    } catch (_) {}
  }
  out.sources = [...new Set(out.sources)];
  return out;
}

module.exports = { turn, ownThread, WEB, fetchPublic };
