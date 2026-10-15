/*
 * Buddy — a child's safe chat friend (typed or spoken), with every guard from the family app it came from:
 *
 *   1. Hard blocks (self-harm, sexual, strangers/secrets, violence words outside a sports/story context)
 *      → the model is never called; the child gets a kind canned reply; the turn is flagged and parents alerted.
 *   2. PII (phone, address, postcode, email, school name, surname) is redacted BEFORE anything leaves the box;
 *      the original words are kept for parents only, and parents are alerted.
 *   3. A small "is this safe for a child?" classifier (KIDS_CLASSIFY_MODEL) on the redacted text → block as (1).
 *   4. "Ignore your rules" style messages are flagged and the model is told to stay in its rules.
 *   5. Drift detection: 3+ silly/testing messages in a row → Buddy gently veers to a learning game.
 *   6. Output guard on every reply: banned words → canned reply; human/feelings/best-friend claims, secret
 *      promises, medicine amounts → regenerate once (else canned); AI-refusal phrasing → friendly replacement;
 *      too long → regenerate shorter. Every reply is signed "— Buddy".
 *   7. Optional daily time limit (KIDS_BUDDY_LIMIT_ENABLED=true, KIDS_BUDDY_DAILY_MINUTES, default off).
 *
 * Model: util.kidsLlm (KIDS_LLM_URL/MODEL) — no tools, no web, no agent. Voice: the recording is held in memory
 * only, transcribed with the local Whisper, then wiped — audio is never written to disk or kept.
 * Parents (Family → child → Buddy) can read every conversation, see every flag and mark flags reviewed.
 * A child whose settings.kids.no_alerts is true never triggers parent alerts (used by the red-team suite).
 */
const express = require('express');
const { pool } = require('../db');
const util = require('./util');
const sprig = require('./sprig');
const safety = require('./safety');

const LIMIT_ENABLED = String(process.env.KIDS_BUDDY_LIMIT_ENABLED || 'false').toLowerCase() === 'true';
const DAILY_LIMIT_MIN = parseInt(process.env.KIDS_BUDDY_DAILY_MINUTES || '30', 10);
const SESSION_LIMIT_MIN = parseInt(process.env.KIDS_BUDDY_SESSION_MINUTES || '10', 10);
const MAX_HISTORY_TURNS = 16;
const SESSION_INACTIVITY_MIN = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TANGLED = "Oops, my brain got a bit tangled. Try again in a second?\n— Buddy";
const DIDNT_HEAR = "I didn't catch that — try again?\n— Buddy";
const BREAK_TIME = "Lots of chatting today! Let's take a break — see you tomorrow, friend!\n— Buddy";

// Flags that are about length or plumbing, not safety — recorded, but they don't page a parent.
const QUIET_FLAGS = /^(too_long|llm_error|injection)/;

const kidSettings = (child) => ((child.settings || {}).kids) || {};
const ageOf = (child) => parseInt(kidSettings(child).age, 10) || 7;

// ---------- storage ----------
async function getOrCreateSession(childId, sessionId) {
  if (sessionId && UUID.test(sessionId)) {
    const { rows: [s] } = await pool.query(
      `SELECT MAX(created_at) AS last FROM kid_chat_messages WHERE session_id=$1 AND child_id=$2`, [sessionId, childId]);
    if (s && s.last && (Date.now() - new Date(s.last).getTime()) / 60000 < SESSION_INACTIVITY_MIN) return sessionId;
  }
  const { rows: [{ id }] } = await pool.query('SELECT gen_random_uuid() AS id');
  return id;
}

async function loadHistory(sessionId) {
  const { rows } = await pool.query(
    `SELECT role, content FROM kid_chat_messages
      WHERE session_id=$1 AND NOT flagged AND removed_at IS NULL
      ORDER BY created_at DESC, id DESC LIMIT $2`, [sessionId, MAX_HISTORY_TURNS * 2]);
  return rows.reverse();
}

async function record(m) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO kid_chat_messages(child_id, session_id, role, content, raw_content, voice, flagged, flag_type, flag_reason, drifting, llm_model)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at`,
    [m.childId, m.sessionId, m.role, m.content, m.rawContent || null, !!m.voice, !!m.flagged,
      m.flagType || null, m.flagReason ? String(m.flagReason).slice(0, 300) : null, !!m.drifting, m.llmModel || null]);
  return row;
}

async function recentDriftCount(sessionId) {
  const { rows } = await pool.query(
    `SELECT drifting FROM kid_chat_messages WHERE session_id=$1 AND role='user' ORDER BY created_at DESC, id DESC LIMIT 5`, [sessionId]);
  let n = 0;
  for (const x of rows) { if (x.drifting) n += 1; else break; }
  return n;
}

// Approximation carried over from the original: ~30 s per message the child sends today.
async function todayMinutes(child) {
  const tz = child.tz || process.env.TZ_DEFAULT || 'Europe/London';
  const { rows: [{ n }] } = await pool.query(
    `SELECT COUNT(*)::int n FROM kid_chat_messages WHERE child_id=$1 AND role='user'
        AND created_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)`, [child.id, tz]);
  return Math.round(n * 0.5);
}

async function limitCheck(child) {
  if (!LIMIT_ENABLED) return { ok: true, enabled: false };
  const used = await todayMinutes(child);
  if (used >= DAILY_LIMIT_MIN) return { ok: false, enabled: true, reason: 'daily_limit', usedMinutes: used, dailyLimit: DAILY_LIMIT_MIN };
  return { ok: true, enabled: true, usedMinutes: used, dailyLimit: DAILY_LIMIT_MIN, sessionLimit: SESSION_LIMIT_MIN };
}

// ---------- parent alerts ----------
const lastAlert = new Map();   // `${child}:${kind}` → ms, so a child repeating a word can't page parents 20 times
function describe(flagType, flagReason) {
  const why = String(flagReason || '');
  if (/^self_harm/.test(why)) return 'said something about hurting themself or not wanting to be here. Please check in with them gently.';
  if (/^sexual/.test(why)) return 'asked about something sexual or private.';
  if (/^strangers/.test(why)) return 'mentioned secrets, meeting up or personal details.';
  if (/^violence/.test(why)) return 'used violent words.';
  if (/^pii/.test(flagType || '')) return 'shared personal details (hidden from the AI).';
  if (/context_block/.test(flagType || '')) return 'sent a message the safety check stopped.';
  return 'got a reply that the safety check had to change.';
}
function flagAlert(child, { rowId, flagType, flagReason }) {
  if (!flagType || QUIET_FLAGS.test(flagType)) return;
  if (kidSettings(child).no_alerts === true) return;
  const kind = /^self_harm/.test(String(flagReason || '')) ? `self_harm:${rowId}` : `${flagType}:${String(flagReason || '').split(':')[0]}`;
  const key = `${child.id}:${kind}`;
  const now = Date.now();
  if (lastAlert.has(key) && now - lastAlert.get(key) < 10 * 60 * 1000) return;
  lastAlert.set(key, now);
  util.alertParents(`🚩 Buddy: ${child.name} ${describe(flagType, flagReason)}\nOpen Family → ${child.name} → Buddy to read it.`,
    { tag: 'kids-safety', url: `/#family/child/${child.id}/buddy` }).catch(() => {});
}

// ---------- one turn ----------
async function chatModel(child, history, userMessage, extra = []) {
  const messages = [{ role: 'system', content: safety.buddyPrompt(child) }];
  for (const x of extra) messages.push({ role: 'system', content: x });
  for (const m of history) messages.push({ role: m.role, content: m.content });
  messages.push({ role: 'user', content: userMessage });
  return util.kidsLlm(messages, { maxTokens: 400, temperature: 0.7, timeoutMs: 90000 });
}

async function processMessage({ child, sessionId, rawMessage, voice, asParent }) {
  const message = String(rawMessage || '').trim();
  if (!message) return { error: 'empty_message' };
  if (message.length > 2000) return { error: 'too_long' };

  const limits = await limitCheck(child);
  if (!limits.ok) return { ok: true, error: 'time_limit', limit: limits, response: BREAK_TIME };

  sessionId = await getOrCreateSession(child.id, sessionId);
  const base = { childId: child.id, sessionId };
  const model = process.env.KIDS_LLM_MODEL || null;

  const ig = await safety.inputGuard(message);
  if (ig.block) {
    const userRow = await record({ ...base, role: 'user', content: ig.storeContent, rawContent: ig.rawContent, voice,
      flagged: true, flagType: ig.flagType, flagReason: ig.flagReason });
    const reply = safety.CANNED_BLOCK_RESPONSE;
    const asst = await record({ ...base, role: 'assistant', content: reply, flagged: true, flagType: ig.flagType, flagReason: 'auto_response_to_block' });
    flagAlert(child, { rowId: userRow.id, flagType: ig.flagType, flagReason: ig.flagReason });
    await util.audit(child.id, 'buddy_block', { session_id: sessionId, message_id: userRow.id, flag_type: ig.flagType });
    return { ok: true, sessionId, response: reply, messageId: asst.id, blocked: true, flagType: ig.flagType, limits };
  }

  const injection = safety.detectInjection(ig.storeContent);
  let flagType = ig.flagType, flagReason = ig.flagReason;
  if (injection) {
    flagType = flagType ? `${flagType}+injection` : 'injection';
    flagReason = (flagReason ? `${flagReason} | ` : '') + `injection: "${injection}"`;
  }

  const history = await loadHistory(sessionId);
  const drifting = await safety.classifyDrift({ history, message: ig.storeContent });
  const userRow = await record({ ...base, role: 'user', content: ig.storeContent, rawContent: ig.rawContent, voice,
    flagged: !!(ig.pii || injection), flagType, flagReason, drifting });
  if (ig.pii) flagAlert(child, { rowId: userRow.id, flagType: 'pii', flagReason: ig.flagReason });

  const consecutiveDrift = await recentDriftCount(sessionId);
  const extra = [];
  if (consecutiveDrift >= 3) extra.push(safety.VEER_INSTRUCTION);
  if (injection) extra.push(safety.INJECTION_INSTRUCTION);

  let first;
  try { first = await chatModel(child, history, ig.storeContent, extra); }
  catch (e) {
    const asst = await record({ ...base, role: 'assistant', content: TANGLED, flagged: true, flagType: 'llm_error', flagReason: e.message });
    return { ok: true, sessionId, response: TANGLED, messageId: asst.id, error: 'llm_error', limits };
  }

  let outputText = safety.ensureBuddySignature(first);
  const og = safety.outputGuard(outputText);
  let outputFlag = null, outputFlagReason = null;
  if (!og.ok) {
    outputFlag = og.flagType; outputFlagReason = og.flagReason;
    if (og.regenerate) {
      const fix = og.shorten
        ? `Your previous answer was too long. Rewrite it as ONE or TWO short, friendly sentences for a ${ageOf(child)}-year-old. End with — Buddy.`
        : 'Your previous answer broke the rules. Reply again, briefly and friendly, without claiming to be human, without saying you have feelings, without promising to keep secrets from grown-ups, without saying any medicine amounts, and without breaking any of the safety rules. End with — Buddy.';
      try {
        const second = safety.ensureBuddySignature(await chatModel(child, history, ig.storeContent, [...extra, fix]));
        if (safety.outputGuard(second).ok) outputText = second;
        else { outputText = safety.ensureBuddySignature(safety.CANNED_BLOCK_RESPONSE); outputFlag = `${outputFlag || 'output_block'}+retry_fail`; }
      } catch (_) {
        outputText = safety.ensureBuddySignature(safety.CANNED_BLOCK_RESPONSE); outputFlag = `${outputFlag || 'output_block'}+retry_fail`;
      }
    } else if (og.replacement) {
      outputText = safety.ensureBuddySignature(og.replacement);
    } else {
      outputText = safety.ensureBuddySignature(safety.CANNED_BLOCK_RESPONSE);
    }
  }

  const asst = await record({ ...base, role: 'assistant', content: outputText, flagged: !!outputFlag, flagType: outputFlag,
    flagReason: outputFlagReason, llmModel: model });
  if (outputFlag) flagAlert(child, { rowId: asst.id, flagType: outputFlag, flagReason: outputFlagReason });
  await util.audit(child.id, 'buddy_llm', { session_id: sessionId, model, drifting, veer: consecutiveDrift >= 3, injection: !!injection });

  // A normal, friendly exchange grows the sprig a little (gentle daily cap). Never for flagged, silly or blocked turns.
  let sprigOut = null;
  if (!asParent && !outputFlag && !ig.pii && !injection && !drifting) {
    sprigOut = await sprig.reward(child.id, 'buddy', `msg:${asst.id}`).catch(() => null);
  }
  return { ok: true, sessionId, response: outputText, messageId: asst.id, drifting, veering: consecutiveDrift >= 3,
    flagged: !!outputFlag, limits, ...(sprigOut ? { sprig: sprigOut } : {}) };
}

module.exports = {
  processMessage,   // used by scripts/redteam-kids.js — the same path the HTTP routes take
  routes(r, { parentOnly }) {
    // One message at a time per child (a stuck button can't fire twenty model calls).
    const inFlight = new Set();
    const childOnly = (req, res, next) => (req.asParent
      ? res.status(403).json({ ok: false, error: `Buddy chats are just for ${req.kid.name} — you can read them in Family.` }) : next());
    async function oneAtATime(req, res, fn) {
      if (inFlight.has(req.kid.id)) return res.status(429).json({ ok: false, error: 'Buddy is still thinking about your last message!' });
      inFlight.add(req.kid.id);
      try { return await fn(); } finally { inFlight.delete(req.kid.id); }
    }

    const send = (res, result, extra = {}) => {
      if (result.error === 'empty_message') return res.status(400).json({ ok: false, error: 'Type something first!' });
      if (result.error === 'too_long') return res.status(400).json({ ok: false, error: 'That message is too long for Buddy.' });
      return res.json({ ...result, ...extra });
    };

    // ---------- child endpoints ----------
    r.get('/buddy/status', async (req, res) => {
      res.json({ ok: true, limits: await limitCheck(req.kid), voice: !!process.env.WHISPER_URL, tts: !!(process.env.TTS_URL && process.env.KIDS_TTS_VOICE), model: util.llmConfigured() });
    });

    // The conversation still going on (if the child left the screen and came back within 30 minutes).
    r.get('/buddy/recent', async (req, res) => {
      const { rows: [last] } = await pool.query(
        `SELECT session_id, created_at FROM kid_chat_messages WHERE child_id=$1 AND removed_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`, [req.kid.id]);
      if (!last || (Date.now() - new Date(last.created_at).getTime()) / 60000 >= SESSION_INACTIVITY_MIN) return res.json({ ok: true, sessionId: null, messages: [] });
      const { rows } = await pool.query(
        `SELECT id, role, content, created_at FROM kid_chat_messages WHERE session_id=$1 AND child_id=$2 AND removed_at IS NULL ORDER BY created_at, id LIMIT 60`,
        [last.session_id, req.kid.id]);
      res.json({ ok: true, sessionId: last.session_id, messages: rows });
    });

    r.post('/buddy/chat', childOnly, (req, res, next) => oneAtATime(req, res, async () => {
      const b = req.body || {};
      const result = await processMessage({ child: req.kid, sessionId: b.sessionId || null, rawMessage: b.message, voice: false, asParent: req.asParent });
      send(res, result);
    }).catch(next));

    // Voice: raw audio body. Held in memory only, transcribed, then zeroed — never written to disk, never kept.
    r.post('/buddy/voice', childOnly, express.raw({ type: () => true, limit: '12mb' }), (req, res, next) => oneAtATime(req, res, async () => {
      const audio = Buffer.isBuffer(req.body) ? req.body : null;
      if (!audio || audio.length < 200) return res.status(400).json({ ok: false, error: 'I didn’t hear anything — try again?' });
      let transcript = '';
      try { transcript = await util.transcribe(audio, String(req.get('content-type') || 'audio/webm')); }
      catch (e) { console.warn('[buddy] transcribe failed:', e.message); return res.status(502).json({ ok: false, error: 'Buddy couldn’t hear that. Try again, or type it?' }); }
      finally { audio.fill(0); req.body = null; }
      const sessionId = req.query.session || req.get('X-Buddy-Session') || null;
      const result = await processMessage({ child: req.kid, sessionId, rawMessage: transcript, voice: true, asParent: req.asParent });
      if (result.error === 'empty_message') return res.json({ ok: true, transcript, response: DIDNT_HEAR });
      // The child sees what Buddy heard.
      send(res, result, { transcript });
    }).catch(next));

    // Read one of Buddy's replies aloud with the server voice — only when KIDS_TTS_VOICE is set (+ TTS_URL, an
    // OpenAI-compatible /audio/speech such as Kokoro). Otherwise the app uses the device's own voice.
    r.post('/buddy/speak/:id', async (req, res, next) => {
      try {
        const url = (process.env.TTS_URL || '').replace(/\/$/, '');
        if (!url || !process.env.KIDS_TTS_VOICE) return res.status(404).json({ ok: false, error: 'no server voice' });
        const { rows: [m] } = await pool.query(
          `SELECT content FROM kid_chat_messages WHERE id=$1 AND child_id=$2 AND role='assistant'`, [parseInt(req.params.id, 10) || 0, req.kid.id]);
        if (!m) return res.status(404).json({ ok: false, error: 'not found' });
        const input = m.content.replace(/\s*[—–-]*\s*Buddy[!.]?\s*$/i, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, '').trim();
        if (!input) return res.status(204).end();
        const t = await fetch(`${url}/audio/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: process.env.KIDS_TTS_MODEL || 'kokoro', input, voice: process.env.KIDS_TTS_VOICE, response_format: 'mp3' }),
          signal: AbortSignal.timeout(30000) });
        if (!t.ok) return res.status(502).json({ ok: false, error: `voice ${t.status}` });
        res.set('Content-Type', t.headers.get('content-type') || 'audio/mpeg');
        res.set('Cache-Control', 'no-store');
        res.send(Buffer.from(await t.arrayBuffer()));
      } catch (e) { next(e); }
    });

    // ---------- parent endpoints (Family → child → Buddy) ----------
    r.get('/buddy/parent/summary', parentOnly, async (req, res) => {
      const { rows: [s] } = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE flagged AND reviewed_at IS NULL)::int AS pending,
                COUNT(*) FILTER (WHERE created_at >= NOW() - interval '7 days')::int AS msgs7,
                COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - interval '7 days')::int AS sessions7,
                COUNT(*) FILTER (WHERE flagged AND created_at >= NOW() - interval '7 days')::int AS flagged7,
                COUNT(*)::int AS total
           FROM kid_chat_messages WHERE child_id=$1 AND removed_at IS NULL`, [req.kid.id]);
      res.json({ ok: true, pendingReview: s.pending, last7d: { msgs: s.msgs7, sessions: s.sessions7, flagged: s.flagged7 }, total: s.total,
        limitEnabled: LIMIT_ENABLED, dailyLimit: LIMIT_ENABLED ? DAILY_LIMIT_MIN : null });
    });

    r.get('/buddy/parent/sessions', parentOnly, async (req, res) => {
      const limit = Math.min(parseInt(req.query.limit, 10) || 40, 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const { rows } = await pool.query(
        `SELECT session_id, MIN(created_at) AS started, MAX(created_at) AS last,
                COUNT(*) FILTER (WHERE role='user')::int AS said,
                COUNT(*) FILTER (WHERE role='user' AND voice)::int AS spoken,
                COUNT(*) FILTER (WHERE flagged)::int AS flagged,
                COUNT(*) FILTER (WHERE flagged AND reviewed_at IS NULL)::int AS unreviewed,
                (ARRAY_AGG(content ORDER BY created_at, id) FILTER (WHERE role='user'))[1] AS preview
           FROM kid_chat_messages WHERE child_id=$1 AND removed_at IS NULL
          GROUP BY session_id ORDER BY MAX(created_at) DESC LIMIT $2 OFFSET $3`, [req.kid.id, limit, offset]);
      res.json({ ok: true, sessions: rows.map((x) => ({ ...x, preview: (x.preview || '').slice(0, 120) })) });
    });

    r.get('/buddy/parent/messages', parentOnly, async (req, res) => {
      const q = req.query, where = ['m.child_id=$1', 'm.removed_at IS NULL'], params = [req.kid.id];
      const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
      if (q.session && UUID.test(q.session)) add('m.session_id = ?', q.session);
      if (q.id) add('m.id = ?', parseInt(q.id, 10) || 0);
      if (q.flagged === 'true') where.push('m.flagged');
      if (q.flagged === 'false') where.push('NOT m.flagged');
      if (q.unreviewed === 'true') where.push('m.flagged AND m.reviewed_at IS NULL');
      const limit = Math.min(parseInt(q.limit, 10) || 200, 500);
      const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
      params.push(limit, offset);
      const order = q.session ? 'm.created_at, m.id' : 'm.created_at DESC, m.id DESC';
      const { rows } = await pool.query(
        `SELECT m.id, m.session_id, m.role, m.content, m.raw_content, m.voice, m.flagged, m.flag_type, m.flag_reason, m.drifting,
                m.llm_model, m.reviewed_at, u.name AS reviewed_by, m.created_at
           FROM kid_chat_messages m LEFT JOIN users u ON u.id = m.reviewed_by
          WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
      res.json({ ok: true, messages: rows });
    });

    // Mark flags reviewed: { ids: [..] } or { session } or { all: true }; { undo: true } un-marks.
    r.post('/buddy/parent/review', parentOnly, async (req, res) => {
      const b = req.body || {};
      const ids = Array.isArray(b.ids) ? b.ids.map((x) => parseInt(x, 10)).filter(Number.isFinite).slice(0, 500) : [];
      if (!ids.length && !(b.session && UUID.test(b.session)) && b.all !== true) return res.status(400).json({ ok: false, error: 'Nothing to mark' });
      const params = [req.kid.id, b.undo ? null : req.uid];
      let scope = '';
      if (ids.length) { params.push(ids); scope = `AND id = ANY($${params.length})`; }
      else if (b.session) { params.push(b.session); scope = `AND session_id = $${params.length}`; }
      const { rowCount } = await pool.query(
        `UPDATE kid_chat_messages SET reviewed_at = ${b.undo ? 'NULL' : 'NOW()'}, reviewed_by = $2
          WHERE child_id=$1 AND flagged ${b.undo ? 'AND reviewed_at IS NOT NULL' : 'AND reviewed_at IS NULL'} ${scope}`, params);
      await util.audit(req.uid, b.undo ? 'buddy_unreview' : 'buddy_review', { child_id: req.kid.id, ids, session: b.session || null, all: !!b.all, n: rowCount });
      res.json({ ok: true, marked: rowCount });
    });

    r.get('/buddy/parent/export', parentOnly, async (req, res) => {
      const { rows } = await pool.query(
        `SELECT id, session_id, role, content, raw_content, voice, flagged, flag_type, flag_reason, drifting, llm_model, reviewed_at, created_at
           FROM kid_chat_messages WHERE child_id=$1 AND removed_at IS NULL ORDER BY created_at, id`, [req.kid.id]);
      await util.audit(req.uid, 'buddy_export', { child_id: req.kid.id, n: rows.length });
      res.set('Content-Type', 'application/json');
      res.set('Content-Disposition', `attachment; filename="buddy-chats-${Date.now()}.json"`);
      res.send(JSON.stringify({ exportedAt: new Date().toISOString(), child: req.kid.name, messages: rows }, null, 2));
    });

  },
};
