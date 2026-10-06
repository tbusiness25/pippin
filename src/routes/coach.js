const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const { CATEGORIES } = require('../brains/prompts');

module.exports = (brain) => {
  const router = express.Router();
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Kick off today's plan. Brains with tools (Hermes) can take a minute or two, so this returns
  // at once and the plan is filled in the background; the UI polls GET /plan.
  router.post('/plan', async (req, res) => {
    const user = await game.getUser(req.uid);
    const today = game.localDay(user.tz);
    const { rows: running } = await pool.query(
      `SELECT id FROM plans WHERE user_id=$1 AND day=$2 AND status='pending' AND created_at > NOW() - interval '10 minutes'`,
      [req.uid, today]);
    if (running.length) return res.json({ ok: true, id: running[0].id, status: 'pending' });
    const { rows } = await pool.query('INSERT INTO plans(user_id, day) VALUES ($1,$2) RETURNING id', [req.uid, today]);
    const id = rows[0].id;
    res.json({ ok: true, id, status: 'pending' });

    (async () => {
      try {
        const { rows: ck } = await pool.query(
          `SELECT mood, energy FROM checkins WHERE user_id=$1 AND day=$2 ORDER BY created_at DESC LIMIT 1`, [req.uid, today]);
        const { rows: goals } = await pool.query(
          `SELECT title FROM goals WHERE user_id=$1 AND deleted_at IS NULL
             AND ((once_on IS NULL AND $3 = ANY(days)) OR once_on = $2)`,
          [req.uid, today, game.localWeekday(user.tz)]);
        const plan = await brain.planDay({
          today, weekday: WEEKDAYS[game.localWeekday(user.tz)],
          mood: ck[0]?.mood, energy: ck[0]?.energy, existingGoals: goals.map((g) => g.title),
        });
        const suggestions = (plan.suggestions || []).slice(0, 5).map((s) => ({
          title: String(s.title || '').slice(0, 80),
          category: CATEGORIES.includes(s.category) ? s.category : 'general',
          why: String(s.why || '').slice(0, 160),
          steps: (Array.isArray(s.steps) ? s.steps : []).slice(0, 5).map((t) => String(t).slice(0, 120)),
        })).filter((s) => s.title);
        await pool.query(`UPDATE plans SET status='ready', summary=$2, suggestions=$3 WHERE id=$1`,
          [id, String(plan.summary || '').slice(0, 400), JSON.stringify(suggestions)]);
      } catch (e) {
        console.error('[plan] failed:', e.message);
        await pool.query(`UPDATE plans SET status='failed', error=$2 WHERE id=$1`, [id, e.message.slice(0, 300)]);
      }
    })();
  });

  router.get('/plan', async (req, res) => {
    const user = await game.getUser(req.uid);
    const { rows } = await pool.query(
      `SELECT id, status, summary, suggestions, error, created_at FROM plans
       WHERE user_id=$1 AND day=$2 ORDER BY created_at DESC LIMIT 1`, [req.uid, game.localDay(user.tz)]);
    res.json({ ok: true, plan: rows[0] || null });
  });

  // Turn one suggestion into a goal for today only.
  router.post('/plan/:id/accept/:i', async (req, res) => {
    const { rows } = await pool.query('SELECT day, suggestions FROM plans WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
    const s = rows[0]?.suggestions?.[Number(req.params.i)];
    if (!s) return res.status(404).json({ ok: false });
    if (s.accepted) return res.json({ ok: true });
    await pool.query(
      `INSERT INTO goals(user_id, title, category, days, once_on, steps, why, source)
       VALUES ($1,$2,$3,'{}',$4,$5,$6,'coach')`,
      [req.uid, s.title, s.category, rows[0].day, JSON.stringify(s.steps.map((t) => ({ text: t, done: false }))), s.why]);
    rows[0].suggestions[Number(req.params.i)].accepted = true;
    await pool.query('UPDATE plans SET suggestions=$2 WHERE id=$1', [req.params.id, JSON.stringify(rows[0].suggestions)]);
    res.json({ ok: true });
  });

  // ---------- the private coach (Pippin's own engine — never Hermes) ----------
  const engine = require('../coach/engine');
  const llm = require('../coach/llm');
  const { decrypt } = require('../coach/crypto');

  router.get('/info', (req, res) => res.json({ ok: true, model: llm.label(), local: llm.local(), configured: llm.configured(),
    flows: Object.entries(engine.FLOWS).map(([id, f]) => ({ id, label: f.label })),
    voice: !!(process.env.WHISPER_URL && process.env.TTS_URL), retentionDays: parseInt(process.env.COACH_RETENTION_DAYS || '60', 10) }));

  // How the coach sounds, and which NHS pages it may use.
  const style = require('../coach/style');
  const library = require('../coach/library');
  router.get('/settings', async (req, res) => {
    const { groups, sources } = library.sources();
    res.json({ ok: true, ...(await style.get(req.uid)), maxInstructions: style.MAX_INSTRUCTIONS,
      personalities: Object.entries(style.PERSONALITIES).map(([id, p]) => ({ id, label: p.label, hint: p.hint })),
      groups, sources: sources.map((s) => ({ ...s, attribution: library.attribution(s) })), licence: library.LICENCE_NOTE });
  });
  router.post('/settings', async (req, res) => res.json({ ok: true, ...(await style.save(req.uid, req.body)) }));

  router.get('/messages', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT role, body_enc, flow, sources, created_at FROM (SELECT * FROM coach_messages WHERE user_id=$1 AND thread_id IS NULL ORDER BY id DESC LIMIT 60) m ORDER BY id`, [req.uid]);
    res.json({ ok: true, messages: rows.map((r) => { try {
      return { role: r.role, content: decrypt(r.body_enc), flow: r.flow, created_at: r.created_at,
        sources: (r.sources || []).map((ref) => library.find(ref)).filter(Boolean) };
    } catch { return null; } }).filter(Boolean) });
  });

  async function respond(req, res, input) {
    try { res.json({ ok: true, ...(await engine.turn(req.uid, input)) }); }
    catch (e) {
      console.error('[coach] turn failed:', e.message);
      // Even if the model is down, a crisis screen hit still returns support.
      const level = input.text ? require('../coach/crisis').screen(input.text) : null;
      res.status(level ? 200 : 502).json(level
        ? { ok: true, reply: 'I can’t think straight right now (my model is offline), but please don’t wait on me — the people below are there right now.', crisis: { level, resources: require('../coach/crisis').resources() }, actions: [] }
        : { ok: false, error: 'Your coach didn’t answer — the model may be offline. Try again in a minute.' });
    }
  }
  router.post('/chat', (req, res) => {
    const text = String((req.body || {}).text || '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ ok: false });
    respond(req, res, { text });
  });
  router.post('/flow/:id', (req, res) => {
    if (!engine.FLOWS[req.params.id]) return res.status(404).json({ ok: false });
    respond(req, res, { flow: req.params.id });
  });

  // Voice: audio in → local Whisper → coach → local TTS (MP3 as base64). Nothing leaves the network.
  router.post('/voice', express.raw({ type: () => true, limit: '12mb' }), async (req, res) => {
    if (!process.env.WHISPER_URL) return res.status(400).json({ ok: false, error: 'Voice not set up' });
    try {
      const form = new FormData();
      form.append('file', new Blob([req.body], { type: req.headers['content-type'] || 'audio/webm' }), 'speech.webm');
      form.append('model', process.env.WHISPER_MODEL || 'whisper-1');
      form.append('language', 'en');
      const tr = await fetch(`${process.env.WHISPER_URL.replace(/\/$/, '')}/audio/transcriptions`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
      if (!tr.ok) throw new Error(`whisper ${tr.status}`);
      const text = String((await tr.json()).text || '').trim();
      if (!text) return res.json({ ok: true, heard: '', reply: 'I didn’t catch that — try again?', actions: [] });
      const out = await engine.turn(req.uid, { text });
      res.json({ ok: true, heard: text, ...out, audio: await speak(out.reply) });
    } catch (e) {
      console.error('[coach voice]', e.message);
      res.status(502).json({ ok: false, error: 'Voice didn’t work this time — try typing.' });
    }
  });
  router.post('/speak', async (req, res) => {
    try { res.json({ ok: true, audio: await speak(String((req.body || {}).text || '').slice(0, 2000)) }); }
    catch (e) { res.status(502).json({ ok: false }); }
  });
  async function speak(text) {
    if (!process.env.TTS_URL || !text) return null;
    const r = await fetch(`${process.env.TTS_URL.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model: process.env.TTS_MODEL || 'kokoro', voice: process.env.TTS_VOICE || 'bf_emma',
        input: text.replace(/[*_#`>]/g, '').replace(/\n+/g, ' '), response_format: 'mp3' }) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer()).toString('base64');
  }

  return router;
};
