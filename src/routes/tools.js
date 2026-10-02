/* Self-care tools, reflections, quizzes, the daily question, journeys and insights. */
const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const rewards = require('../rewards');
const C = require('../content');

const router = express.Router();

router.get('/content', (req, res) => res.json({
  ok: true, breathing: C.BREATHING, stretches: C.STRETCHES, prompts: C.REFLECTION_PROMPTS,
  quizzes: Object.fromEntries(Object.entries(C.QUIZZES).map(([k, q]) => [k, { name: q.name, about: q.about }])),
  journeys: C.JOURNEYS.map((j) => ({ id: j.id, name: j.name, emoji: j.emoji, about: j.about, length: j.days.length })),
}));

// A finished breathing / sound / focus / stretch session.
router.post('/session', async (req, res) => {
  const { kind, detail, seconds } = req.body || {};
  if (!['breathing', 'sound', 'focus', 'stretch'].includes(kind)) return res.status(400).json({ ok: false });
  if ((seconds | 0) < 30) return res.json({ ok: true, messages: [] });      // too short to count
  res.json({ ok: true, ...(await rewards.onToolSession(req.uid, kind, String(detail || '').slice(0, 40), seconds)) });
});

// ---------- reflections ----------
router.get('/reflections', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, prompt, body, tags, created_at FROM reflections WHERE user_id=$1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 100`, [req.uid]);
  res.json({ ok: true, reflections: rows });
});
router.post('/reflections', async (req, res) => {
  const { prompt, body, tags } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ ok: false, error: 'Write a little first' });
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM reflections WHERE user_id=$1 AND day=$2', [req.uid, day]);
  await pool.query('INSERT INTO reflections(user_id, prompt, body, tags, day) VALUES ($1,$2,$3,$4,$5)',
    [req.uid, prompt ? String(prompt).slice(0, 300) : null, String(body).slice(0, 10000),
      Array.isArray(tags) ? tags.map(String).slice(0, 6) : [], day]);
  const messages = [];
  let energy = null;
  if (n === 0) { energy = await game.addEnergy(req.uid, 3, 'reflection'); messages.push('+3 energy'); }
  messages.push(...await rewards.onReflection(req.uid));
  res.json({ ok: true, energy, messages });
});
router.delete('/reflections/:id', async (req, res) => {
  await pool.query('UPDATE reflections SET deleted_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

// ---------- quizzes ----------
router.get('/quiz/:id', (req, res) => {
  const q = C.QUIZZES[req.params.id];
  if (!q) return res.status(404).json({ ok: false });
  res.json({ ok: true, quiz: { id: req.params.id, ...q } });
});
router.post('/quiz/:id', async (req, res) => {
  const q = C.QUIZZES[req.params.id];
  const answers = (req.body || {}).answers;
  if (!q || !Array.isArray(answers) || answers.length !== q.questions.length) return res.status(400).json({ ok: false });
  const clean = answers.map((a) => Math.max(0, Math.min(q.options.length - 1, a | 0)));
  let score = clean.reduce((a, b) => a + b, 0);
  const band = [...q.bands].reverse().find(([min]) => score >= min)[1];
  await pool.query('INSERT INTO quiz_results(user_id, quiz, score, answers) VALUES ($1,$2,$3,$4)', [req.uid, req.params.id, score, clean]);
  const { rows } = await pool.query(
    'SELECT score, created_at FROM quiz_results WHERE user_id=$1 AND quiz=$2 ORDER BY created_at DESC LIMIT 6', [req.uid, req.params.id]);
  res.json({
    ok: true, score, band, max: q.questions.length * (q.options.length - 1),
    // Any answer above "not at all" on the self-harm item always shows support.
    support: (q.safetyItem != null && clean[q.safetyItem] > 0) || /severe/.test(band) || /low/.test(band),
    history: rows,
  });
});

// ---------- monthly check-ins (GAD-7 by default; PHQ-9 / WHO-5 optional) ----------
// A repeated questionnaire is most useful as a trend you can show a GP or therapist.
async function checksDue(uid) {
  const user = await game.getUser(uid);
  const chosen = (user.settings || {}).monthly_checks || ['gad7'];
  const out = [];
  for (const q of chosen) {
    if (!C.QUIZZES[q]) continue;
    const { rows } = await pool.query('SELECT score, created_at FROM quiz_results WHERE user_id=$1 AND quiz=$2 ORDER BY created_at DESC LIMIT 1', [uid, q]);
    const last = rows[0] || null;
    const days = last ? Math.floor((Date.now() - new Date(last.created_at)) / 86400000) : null;
    out.push({ quiz: q, name: C.QUIZZES[q].name, last, daysSince: days, due: days == null || days >= 28 });
  }
  return { chosen, checks: out };
}
router.get('/checks', async (req, res) => res.json({ ok: true, ...(await checksDue(req.uid)),
  available: Object.entries(C.QUIZZES).map(([k, q]) => ({ id: k, name: q.name })) }));
router.post('/checks/settings', async (req, res) => {
  const list = (Array.isArray((req.body || {}).checks) ? req.body.checks : []).filter((q) => C.QUIZZES[q]);
  await pool.query(`UPDATE users SET settings = settings || jsonb_build_object('monthly_checks', $2::jsonb) WHERE id=$1`, [req.uid, JSON.stringify(list)]);
  res.json({ ok: true });
});
router.get('/quiz/:id/history', async (req, res) => {
  const q = C.QUIZZES[req.params.id];
  if (!q) return res.status(404).json({ ok: false });
  const { rows } = await pool.query('SELECT score, answers, created_at FROM quiz_results WHERE user_id=$1 AND quiz=$2 ORDER BY created_at', [req.uid, req.params.id]);
  const band = (score) => [...q.bands].reverse().find(([min]) => score >= min)[1];
  res.json({ ok: true, name: q.name, max: q.questions.length * (q.options.length - 1), higherIsBetter: !!q.higherIsBetter,
    results: rows.map((r) => ({ score: r.score, band: band(r.score), at: r.created_at, answers: r.answers })) });
});
// ---------- daily this-or-that ----------
function questionFor(day) {
  const n = Math.floor(new Date(day + 'T12:00:00Z').getTime() / 86400000);
  return n % C.DAILY_QUESTIONS.length;
}
router.get('/daily', async (req, res) => {
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  const qi = questionFor(day);
  const { rows } = await pool.query('SELECT answer FROM daily_answers WHERE user_id=$1 AND day=$2', [req.uid, day]);
  res.json({ ok: true, options: C.DAILY_QUESTIONS[qi], answer: rows[0]?.answer ?? null });
});
router.post('/daily', async (req, res) => {
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  const a = (req.body || {}).answer === 1 ? 1 : 0;
  await pool.query(`INSERT INTO daily_answers(user_id, day, question, answer) VALUES ($1,$2,$3,$4)
                    ON CONFLICT (user_id, day) DO UPDATE SET answer=$4`, [req.uid, day, questionFor(day), a]);
  // How other people on this Pippin answered today (only counts, never names).
  const { rows } = await pool.query('SELECT answer, COUNT(*)::int n FROM daily_answers WHERE day=$1 GROUP BY answer', [day]);
  res.json({ ok: true, tally: [rows.find((r) => r.answer === 0)?.n || 0, rows.find((r) => r.answer === 1)?.n || 0] });
});

// ---------- journeys ----------
router.get('/journeys', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, journey, started_on, step, finished_at, abandoned_at FROM journeys WHERE user_id=$1 ORDER BY started_on DESC', [req.uid]);
  res.json({ ok: true, journeys: rows });
});
router.post('/journeys/:id/start', async (req, res) => {
  const def = C.JOURNEYS.find((j) => j.id === req.params.id);
  if (!def) return res.status(404).json({ ok: false });
  const { rows: active } = await pool.query(
    'SELECT 1 FROM journeys WHERE user_id=$1 AND journey=$2 AND finished_at IS NULL AND abandoned_at IS NULL', [req.uid, def.id]);
  if (active.length) return res.status(409).json({ ok: false, error: 'You’re already on this journey' });
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  await pool.query('INSERT INTO journeys(user_id, journey, started_on) VALUES ($1,$2,$3)', [req.uid, def.id, day]);
  await rewards.issueJourneyGoals(req.uid, day);
  res.json({ ok: true });
});
router.post('/journeys/:jid/stop', async (req, res) => {
  await pool.query('UPDATE journeys SET abandoned_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.jid, req.uid]);
  res.json({ ok: true });
});

// ---------- insights ----------
router.get('/insights', async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days || '30', 10)));
  const uid = req.uid;
  const { rows: mood } = await pool.query(
    `SELECT day::text, ROUND(AVG(mood)::numeric, 1)::float mood, ROUND(AVG(energy)::numeric, 1)::float energy
     FROM checkins WHERE user_id=$1 AND mood IS NOT NULL AND day > CURRENT_DATE - $2::int GROUP BY day ORDER BY day`, [uid, days]);
  const { rows: emotions } = await pool.query(
    `SELECT e, COUNT(*)::int n FROM checkins, unnest(emotions) e WHERE user_id=$1 AND day > CURRENT_DATE - $2::int
     GROUP BY e ORDER BY n DESC LIMIT 10`, [uid, days]);
  const { rows: cats } = await pool.query(
    `SELECT g.category, COUNT(*)::int n FROM goal_completions c JOIN goals g ON g.id=c.goal_id
     WHERE c.user_id=$1 AND NOT c.undone AND c.day > CURRENT_DATE - $2::int GROUP BY g.category ORDER BY n DESC`, [uid, days]);
  // What lifts your mood: average mood on days you did X vs days you didn't (needs ≥3 days each side).
  const { rows: lifts } = await pool.query(`
    WITH m AS (SELECT day, AVG(mood) mood FROM checkins WHERE user_id=$1 AND mood IS NOT NULL AND day > CURRENT_DATE - $2::int GROUP BY day),
         act AS (
           SELECT DISTINCT c.day, 'goal: ' || g.category AS what FROM goal_completions c JOIN goals g ON g.id=c.goal_id WHERE c.user_id=$1 AND NOT c.undone
           UNION SELECT DISTINCT day, 'tool: ' || kind FROM tool_sessions WHERE user_id=$1
           UNION SELECT DISTINCT day, 'wrote a reflection' FROM reflections WHERE user_id=$1 AND deleted_at IS NULL),
         whats AS (SELECT DISTINCT what FROM act)
    SELECT w.what,
      ROUND(AVG(m.mood) FILTER (WHERE a.day IS NOT NULL)::numeric, 2)::float with_it,
      ROUND(AVG(m.mood) FILTER (WHERE a.day IS NULL)::numeric, 2)::float without_it,
      COUNT(*) FILTER (WHERE a.day IS NOT NULL)::int n_with, COUNT(*) FILTER (WHERE a.day IS NULL)::int n_without
    FROM whats w CROSS JOIN m LEFT JOIN act a ON a.day = m.day AND a.what = w.what
    GROUP BY w.what`, [uid, days]);
  const { rows: [totals] } = await pool.query(`SELECT
      (SELECT COUNT(*) FROM goal_completions WHERE user_id=$1 AND NOT undone)::int goals,
      (SELECT COUNT(*) FROM checkins WHERE user_id=$1)::int checkins,
      (SELECT COUNT(*) FROM tool_sessions WHERE user_id=$1)::int tools,
      (SELECT COALESCE(SUM(seconds),0) FROM tool_sessions WHERE user_id=$1 AND kind='focus')::int focus_seconds,
      (SELECT COUNT(*) FROM reflections WHERE user_id=$1 AND deleted_at IS NULL)::int reflections`, [uid]);
  res.json({
    ok: true, days, mood, emotions, categories: cats, totals,
    lifts: lifts.filter((l) => l.n_with >= 3 && l.n_without >= 3)
      .map((l) => ({ ...l, diff: +(l.with_it - l.without_it).toFixed(2) }))
      .sort((a, b) => b.diff - a.diff),
  });
});

module.exports = router;
module.exports.checksDue = checksDue;
