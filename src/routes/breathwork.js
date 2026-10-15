/*
 * 🌬️ Breathwork: everyday slow-breathing practices for focus and calm, plus — after a one-time safety check —
 * intense practices (power-breathing rounds with breath holds, a beginner connected-breathing session).
 * Content is in src/breathwork/content.js; the guided sessions run in the browser (public/js/breathwork.js).
 * Adults only (the household child gate does not allow /api/breathwork).
 */
const express = require('express');
const { pool } = require('../db');
const rewards = require('../rewards');
const C = require('../breathwork/content');

const router = express.Router();
const SAFETY_YEARS = 1;   // ask again after a year

router.get('/', async (req, res) => {
  const [{ rows: [safety] }, { rows: recent }, { rows: stats }] = await Promise.all([
    pool.query('SELECT answers, cleared, checked_at FROM breathwork_safety WHERE user_id=$1', [req.uid]),
    pool.query(`SELECT id, practice, seconds, rounds, before, after, eased_off, note, created_at FROM breathwork_sessions
      WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 60`, [req.uid]),
    pool.query(`SELECT practice, COUNT(*)::int n, ROUND(AVG(after - before)::numeric, 2)::float AS change,
      COUNT(*) FILTER (WHERE before IS NOT NULL AND after IS NOT NULL)::int rated
      FROM breathwork_sessions WHERE user_id=$1 AND deleted_at IS NULL GROUP BY practice`, [req.uid]),
  ]);
  const fresh = safety && (Date.now() - new Date(safety.checked_at)) < SAFETY_YEARS * 365 * 86400000;
  const today = await pool.query(`SELECT COUNT(*)::int n FROM breathwork_sessions WHERE user_id=$1 AND deleted_at IS NULL
    AND practice = ANY($2) AND created_at > NOW() - interval '20 hours'`, [req.uid, C.INTENSE]);
  res.json({ ok: true, content: C.PUBLIC, safety: safety ? { ...safety, fresh: !!fresh } : null,
    intenseUnlocked: !!(safety && safety.cleared && fresh), intenseToday: today.rows[0].n, recent, stats });
});

router.post('/safety', async (req, res) => {
  const a = (req.body && req.body.answers) || {};
  const answers = {};
  for (const q of C.SAFETY) answers[q.id] = !!a[q.id];
  const rulesOk = C.RULES.every((r) => !!(req.body && req.body.rules && req.body.rules[r.id]));
  const blocked = C.SAFETY.filter((q) => q.block && answers[q.id]).map((q) => q.id);
  const cleared = rulesOk && !blocked.length;
  await pool.query(`INSERT INTO breathwork_safety(user_id, answers, cleared, checked_at) VALUES ($1,$2,$3,NOW())
    ON CONFLICT (user_id) DO UPDATE SET answers=EXCLUDED.answers, cleared=EXCLUDED.cleared, checked_at=NOW()`, [req.uid, JSON.stringify(answers), cleared]);
  res.json({ ok: true, cleared, blocked, rulesOk, cautions: C.SAFETY.filter((q) => !q.block && answers[q.id]).map((q) => q.id) });
});

router.post('/sessions', async (req, res) => {
  const b = req.body || {};
  const practice = C.ALL.includes(b.practice) ? b.practice : null;
  if (!practice) return res.status(400).json({ ok: false, error: 'Unknown practice' });
  if (C.INTENSE.includes(practice)) {
    const { rows: [s] } = await pool.query('SELECT cleared, checked_at FROM breathwork_safety WHERE user_id=$1', [req.uid]);
    if (!s || !s.cleared) return res.status(403).json({ ok: false, error: 'Do the safety check first' });
  }
  const seconds = Math.max(0, Math.min(7200, parseInt(b.seconds, 10) || 0));
  const rating = (v) => (v == null || v === '' ? null : Math.max(1, Math.min(5, parseInt(v, 10) || 0)) || null);
  const rounds = (Array.isArray(b.rounds) ? b.rounds : []).slice(0, 10).map((x) => Math.max(0, Math.min(600, Math.round(+x || 0))));
  const { rows: [row] } = await pool.query(`INSERT INTO breathwork_sessions(user_id, practice, seconds, rounds, before, after, eased_off, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [req.uid, practice, seconds, JSON.stringify(rounds), rating(b.before), rating(b.after), !!b.eased_off, b.note ? String(b.note).slice(0, 2000) : null]);
  let extra = { messages: [] };
  if (seconds >= 30) extra = await rewards.onToolSession(req.uid, 'breathing', practice, seconds).catch(() => ({ messages: [] }));
  res.json({ ok: true, id: row.id, ...extra });
});

router.patch('/sessions/:id', async (req, res) => {
  const b = req.body || {};
  const rating = (v) => (v == null || v === '' ? null : Math.max(1, Math.min(5, parseInt(v, 10) || 0)) || null);
  await pool.query(`UPDATE breathwork_sessions SET after=COALESCE($3, after), note=COALESCE($4, note) WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.uid, rating(b.after), b.note ? String(b.note).slice(0, 2000) : null]).catch(() => {});
  res.json({ ok: true });
});

router.delete('/sessions/:id', async (req, res) => {
  await pool.query('UPDATE breathwork_sessions SET deleted_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]).catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
