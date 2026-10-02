/*
 * Sobriety / addiction tracker ("I Am Sober"-style, rebuilt around the evidence).
 * Research: docs/research/reports/Habit and sobriety tracker design.md
 *  - HEADLINE = cumulative free days, which never goes down. "Current run" is opt-in and secondary.
 *  - A lapse is an event with a situational debrief + next-24h plan + if-then for next time. No reset, no repair.
 *  - Alcohol: AUDIT-C → AUDIT → withdrawal gate before day one; emergency card days 0–5.
 *  - Per-category hard rules (src/sober/content.js): no quit flow for sedatives/GHB, overdose card on opioid lapses…
 */
const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const S = require('../sober/content');

const router = express.Router();
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

router.get('/content', (req, res) => res.json({ ok: true,
  categories: Object.fromEntries(Object.entries(S.CATEGORIES).map(([k, c]) => [k, { name: c.name, emoji: c.emoji, unit: c.unit, note: c.note, noQuitFlow: !!c.noQuitFlow, screen: c.screen || null, helplines: S.helplines(c.helplines) }])),
  audit: S.AUDIT, withdrawal: S.WITHDRAWAL_QUESTIONS, triggers: S.TRIGGERS, emergency: S.ALCOHOL_EMERGENCY,
  crisis: S.helplines(['emergency', 'nhs111', 'samaritans', 'shout']), helplinesChecked: S.HELPLINES_CHECKED }));

// ---------- screening ----------
router.post('/screen', async (req, res) => {
  const b = req.body || {};
  const answers = Array.isArray(b.answers) ? b.answers.map((a) => Math.max(0, Math.min(4, a | 0))) : [];
  if (answers.length !== 3 && answers.length !== 10) return res.status(400).json({ ok: false, error: 'Answer every question' });
  // Answers are option INDEXES; convert to points (Q9/Q10 score 0/2/4).
  const points = answers.map((i, q) => S.AUDIT[q].o[Math.min(i, S.AUDIT[q].o.length - 1)][1]);
  const auditc = points.slice(0, 3).reduce((a, c) => a + c, 0);
  const audit = answers.length === 10 ? points.reduce((a, c) => a + c, 0) : null;
  // The safety note is the same for everyone (see ALCOHOL_SAFETY): the score is shown, never used to decide.
  const gate = S.alcoholGate();
  await pool.query(`INSERT INTO screenings(user_id, tracker_id, kind, score, answers) VALUES ($1,$2,$3,$4,$5)`,
    [req.uid, /^[0-9a-f-]{36}$/.test(b.tracker_id || '') ? b.tracker_id : null, audit == null ? 'auditc' : 'audit', audit ?? auditc, JSON.stringify({ answers })]);
  res.json({ ok: true, auditc, auditcBand: S.band(S.AUDIT_C_BANDS, auditc), needFull: audit == null && auditc >= 5,
    audit, auditBand: audit == null ? null : S.band(S.AUDIT_BANDS, audit), ...gate,
    safety: S.ALCOHOL_SAFETY, helplines: S.helplines(['gp', 'drinkline', 'withyou']) });
});

// ---------- trackers ----------
async function trackerSummary(t, today) {
  const { rows: days } = await pool.query('SELECT day::text, status, amount, pledged FROM tracker_days WHERE tracker_id=$1 ORDER BY day', [t.id]);
  const start = String(t.start_date);
  const elapsed = today < start ? 0 : daysBetween(start, today) + 1;
  const free = days.filter((d) => d.status === 'free').length;
  const lapses = days.filter((d) => d.status === 'lapse');
  // Current run (opt-in): consecutive free days back from today/yesterday.
  let run = 0;
  const byDay = Object.fromEntries(days.map((d) => [d.day, d.status]));
  for (let d = byDay[today] === 'free' ? today : addDays(today, -1); d >= start && byDay[d] === 'free'; d = addDays(d, -1)) run++;
  const unlogged = [];
  for (let d = start; d < today && unlogged.length < 7; d = addDays(d, 1)) if (!byDay[d]) unlogged.push(d);
  const b = t.baseline || {};
  const perDay = (k) => (Number(b[k]) || 0) / 7;
  const saved = { money: Math.round(perDay('spend') * free), units: Math.round(perDay('units') * free), kcal: Math.round(perDay('kcal') * free) };
  const cat = S.CATEGORIES[t.category] || S.CATEGORIES.other;
  const nextMilestone = S.MILESTONES.find((m) => m > free) || null;
  const { rows: events } = await pool.query(
    `SELECT * FROM risk_events WHERE tracker_id=$1 AND (on_date IS NULL OR on_date >= $2) ORDER BY on_date NULLS LAST LIMIT 10`, [t.id, today]);
  const { rows: [lastScreen] } = await pool.query(`SELECT kind, score, created_at FROM screenings WHERE tracker_id=$1 OR (tracker_id IS NULL AND user_id=$2) ORDER BY created_at DESC LIMIT 1`, [t.id, t.user_id]);
  const rescreenDue = t.category === 'alcohol' && [90, 180, 365].some((m) => free >= m && (!lastScreen || daysBetween(String(lastScreen.created_at).slice(0, 10), today) > 60));
  const { rows: [{ n: recentLapses }] } = await pool.query(`SELECT COUNT(*)::int n FROM tracker_days WHERE tracker_id=$1 AND status='lapse' AND day > $2`, [t.id, addDays(today, -14)]);
  return {
    id: t.id, category: t.category, categoryName: cat.name, emoji: cat.emoji, unit: cat.unit, label: t.label, goal: t.goal,
    start_date: start, target_days: t.target_days, reasons: t.reasons, show_run: t.show_run, discreet: t.discreet, baseline: b,
    started: today >= start, daysUntilStart: today < start ? daysBetween(today, start) : 0,
    elapsed, free, lapseDays: lapses.length, run, saved, nextMilestone,
    today: byDay[today] || null, pledgedToday: days.some((d) => d.day === today && d.pledged) || (await pool.query('SELECT 1 FROM pledges WHERE tracker_id=$1 AND day=$2', [t.id, today])).rows.length > 0,
    unlogged,
    benefits: S.BENEFITS.filter((x) => free >= x.day).slice(-2),
    emergency: t.category === 'alcohol' && today >= start && daysBetween(start, today) <= 5 ? S.ALCOHOL_EMERGENCY : null,
    note: cat.note, helplines: S.helplines(cat.helplines),
    // A pattern (not a single lapse) gently suggests extra support — a design threshold, not a clinical cut-off.
    supportSuggested: recentLapses >= 3,
    events, rescreenDue,
  };
}

router.get('/', async (req, res) => {
  const user = await game.getUser(req.uid);
  const today = game.localDay(user.tz);
  const { rows } = await pool.query('SELECT * FROM trackers WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at', [req.uid]);
  res.json({ ok: true, today, trackers: await Promise.all(rows.map((t) => trackerSummary(t, today))) });
});

router.get('/:id/calendar', async (req, res) => {
  const { rows } = await pool.query(`SELECT day::text, status, amount FROM tracker_days WHERE tracker_id=$1 AND user_id=$2 ORDER BY day`, [req.params.id, req.uid]);
  res.json({ ok: true, days: rows });
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  const cat = S.CATEGORIES[b.category];
  if (!cat) return res.status(400).json({ ok: false, error: 'Pick what you’re tracking' });
  const user = await game.getUser(req.uid);
  const start = isDay(b.start_date) ? b.start_date : game.localDay(user.tz);
  const screening = b.screening || {};
  if (cat.screen === 'audit' && !screening.gate) return res.status(400).json({ ok: false, error: 'Please do the short alcohol check first' });
  if ((cat.screen === 'audit' || cat.noQuitFlow) && !b.acknowledged) {
    return res.status(400).json({ ok: false, error: 'Please read and acknowledge the safety note first' });
  }
  const goal = cat.noQuitFlow ? 'reduce' : (b.goal === 'reduce' ? 'reduce' : 'quit');
  const baseline = {};
  for (const k of ['spend', 'units', 'kcal', 'amount']) if (b.baseline?.[k] != null && !(cat.noCalories && k === 'kcal')) baseline[k] = Math.max(0, Math.min(100000, Number(b.baseline[k]) || 0));
  const { rows } = await pool.query(
    `INSERT INTO trackers(user_id, category, label, goal, start_date, target_days, baseline, reasons, show_run, screening, discreet)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [req.uid, b.category, String(b.label || cat.name).slice(0, 60), goal, start, Math.max(1, Math.min(3650, parseInt(b.target_days, 10) || 365)),
      baseline, (Array.isArray(b.reasons) ? b.reasons : []).map(String).filter(Boolean).slice(0, 12), !!b.show_run,
      { ...screening, acknowledged_at: b.acknowledged ? new Date().toISOString() : null }, b.discreet !== false]);
  await pool.query(`UPDATE screenings SET tracker_id=$2 WHERE user_id=$1 AND tracker_id IS NULL`, [req.uid, rows[0].id]);
  res.json({ ok: true, id: rows[0].id });
});

router.put('/:id', async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query('SELECT category, baseline FROM trackers WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  const cat = S.CATEGORIES[rows[0].category] || {};
  const baseline = { ...rows[0].baseline };
  for (const k of ['spend', 'units', 'kcal', 'amount']) if (b.baseline?.[k] != null && !(cat.noCalories && k === 'kcal')) baseline[k] = Math.max(0, Number(b.baseline[k]) || 0);
  await pool.query(`UPDATE trackers SET label=COALESCE($3,label), reasons=COALESCE($4,reasons), show_run=COALESCE($5,show_run), baseline=$6, discreet=COALESCE($7,discreet), target_days=COALESCE($8,target_days)
                    WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.uid, b.label ? String(b.label).slice(0, 60) : null, Array.isArray(b.reasons) ? b.reasons.map(String).filter(Boolean).slice(0, 12) : null,
      typeof b.show_run === 'boolean' ? b.show_run : null, baseline, typeof b.discreet === 'boolean' ? b.discreet : null, b.target_days ? parseInt(b.target_days, 10) : null]);
  res.json({ ok: true });
});

router.post('/:id/archive', async (req, res) => {
  await pool.query('UPDATE trackers SET archived_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

async function ownTracker(req) {
  const { rows } = await pool.query('SELECT * FROM trackers WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [req.params.id, req.uid]);
  return rows[0] || null;
}

router.post('/:id/pledge', async (req, res) => {
  const t = await ownTracker(req); if (!t) return res.status(404).json({ ok: false });
  const user = await game.getUser(req.uid);
  await pool.query('INSERT INTO pledges(tracker_id, day) VALUES ($1,$2) ON CONFLICT DO NOTHING', [t.id, game.localDay(user.tz)]);
  res.json({ ok: true });
});

// Evening check-in (or backfill): free | lapse. A free day feeds the sprig; milestones count CUMULATIVE free days.
router.post('/:id/day', async (req, res) => {
  const t = await ownTracker(req); if (!t) return res.status(404).json({ ok: false });
  const user = await game.getUser(req.uid);
  const today = game.localDay(user.tz);
  const b = req.body || {};
  const day = isDay(b.day) ? b.day : today;
  if (day > today || day < String(t.start_date)) return res.status(400).json({ ok: false, error: 'That day is outside this tracker' });
  if (!['free', 'lapse'].includes(b.status)) return res.status(400).json({ ok: false });
  const { rows: before } = await pool.query(`SELECT COUNT(*)::int n FROM tracker_days WHERE tracker_id=$1 AND status='free'`, [t.id]);
  const { rows } = await pool.query(
    `INSERT INTO tracker_days(tracker_id, user_id, day, status, amount) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tracker_id, day) DO UPDATE SET status=EXCLUDED.status, amount=EXCLUDED.amount RETURNING (xmax = 0) AS inserted`,
    [t.id, req.uid, day, b.status, b.amount != null ? Number(b.amount) : null]);
  const out = { ok: true, messages: [] };
  if (b.status === 'free') {
    const { rows: after } = await pool.query(`SELECT COUNT(*)::int n FROM tracker_days WHERE tracker_id=$1 AND status='free'`, [t.id]);
    if (rows[0].inserted && day === today) out.energy = await game.addEnergy(req.uid, game.ENERGY.goal, 'free day');
    const hit = S.MILESTONES.find((m) => before[0].n < m && after[0].n >= m);
    if (hit) {
      const acorns = hit >= 100 ? 50 : hit >= 30 ? 25 : 10;
      await game.addAcorns(req.uid, acorns, `milestone ${hit}`);
      out.milestone = { days: hit, acorns };
    }
  } else {
    out.lapse = true;   // client opens the debrief
    const cat = S.CATEGORIES[t.category] || {};
    if (cat.lapseCard === 'overdose') out.overdose = 'Your tolerance drops quickly after a break, so your usual amount could now cause an overdose. Use less, don’t use alone, avoid mixing with alcohol or other depressants, and carry naloxone (free from pharmacies). If someone is unresponsive or struggling to breathe, call 999.';
  }
  res.json(out);
});

// The lapse debrief: situational, forward-looking, and it creates an if-then plan for next time.
router.post('/:id/lapse', async (req, res) => {
  const t = await ownTracker(req); if (!t) return res.status(404).json({ ok: false });
  const user = await game.getUser(req.uid);
  const b = req.body || {};
  const day = isDay(b.day) ? b.day : game.localDay(user.tz);
  let commitmentId = null;
  if (b.next_time) {
    const { rows } = await pool.query(`INSERT INTO commitments(user_id, what, when_text, source) VALUES ($1,$2,$3,'lapse') RETURNING id`,
      [req.uid, String(b.next_time).slice(0, 200), b.next_when ? String(b.next_when).slice(0, 80) : 'next time it comes up']);
    commitmentId = rows[0].id;
  }
  await pool.query(`INSERT INTO lapses(tracker_id, user_id, day, amount, situation, what_happened, next_24h, next_time, commitment_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [t.id, req.uid, day, b.amount != null ? Number(b.amount) : null, (b.situation || []).map(String).slice(0, 8),
      b.what_happened ? String(b.what_happened).slice(0, 2000) : null, b.next_24h ? String(b.next_24h).slice(0, 500) : null,
      b.next_time ? String(b.next_time).slice(0, 300) : null, commitmentId]);
  await pool.query(`INSERT INTO tracker_days(tracker_id, user_id, day, status, amount) VALUES ($1,$2,$3,'lapse',$4)
                    ON CONFLICT (tracker_id, day) DO UPDATE SET status='lapse', amount=COALESCE(EXCLUDED.amount, tracker_days.amount)`,
    [t.id, req.uid, day, b.amount != null ? Number(b.amount) : null]);
  // Logging honestly is the rewarded act.
  await game.addAcorns(req.uid, 3, 'honest lapse log');
  res.json({ ok: true, message: 'Logged. That took honesty — and it’s exactly how this works. Your free days are all still there.' });
});

router.post('/:id/urge', async (req, res) => {
  const t = await ownTracker(req); if (!t) return res.status(404).json({ ok: false });
  const b = req.body || {};
  const clamp = (v) => (v == null || v === '' ? null : Math.max(0, Math.min(10, parseInt(v, 10))));
  await pool.query(`INSERT INTO urges(tracker_id, user_id, before, after, triggers, outcome, note) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [t.id, req.uid, clamp(b.before), clamp(b.after), (b.triggers || []).map(String).slice(0, 8),
      ['passed', 'lapsed', 'unsure'].includes(b.outcome) ? b.outcome : null, b.note ? String(b.note).slice(0, 1000) : null]);
  const messages = [];
  if (b.outcome === 'passed') { await game.addAcorns(req.uid, 5, 'urge surfed'); messages.push('You rode that one out. +5 🌰'); }
  res.json({ ok: true, messages });
});

router.get('/:id/urges', async (req, res) => {
  const { rows } = await pool.query(`SELECT at, before, after, triggers, outcome FROM urges WHERE tracker_id=$1 AND user_id=$2 ORDER BY at DESC LIMIT 100`, [req.params.id, req.uid]);
  const trig = {};
  rows.forEach((u) => u.triggers.forEach((x) => { trig[x] = (trig[x] || 0) + 1; }));
  const hours = Array(24).fill(0);
  rows.forEach((u) => { hours[new Date(u.at).getHours()]++; });
  res.json({ ok: true, urges: rows, triggers: Object.entries(trig).sort((a, b) => b[1] - a[1]), hours });
});

// High-risk events with a plan (refresh it before each one — if-then plans fade after about a month).
router.post('/:id/events', async (req, res) => {
  const t = await ownTracker(req); if (!t) return res.status(404).json({ ok: false });
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ ok: false, error: 'What’s the event?' });
  const s = (v, n = 300) => (v ? String(v).slice(0, n) : null);
  const { rows } = await pool.query(`INSERT INTO risk_events(tracker_id, user_id, title, on_date, plan, drink, exit, script, refreshed_at)
                                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING id`,
    [t.id, req.uid, s(b.title, 80), isDay(b.on_date) ? b.on_date : null, s(b.plan, 1000), s(b.drink), s(b.exit), s(b.script)]);
  res.json({ ok: true, id: rows[0].id });
});
router.put('/:id/events/:eid', async (req, res) => {
  const b = req.body || {};
  const s = (v, n = 300) => (v ? String(v).slice(0, n) : null);
  await pool.query(`UPDATE risk_events SET title=COALESCE($3,title), on_date=$4, plan=$5, drink=$6, exit=$7, script=$8, refreshed_at=NOW()
                    WHERE id=$1 AND user_id=$2`, [req.params.eid, req.uid, s(b.title, 80), isDay(b.on_date) ? b.on_date : null, s(b.plan, 1000), s(b.drink), s(b.exit), s(b.script)]);
  res.json({ ok: true });
});
router.delete('/:id/events/:eid', async (req, res) => {
  await pool.query('DELETE FROM risk_events WHERE id=$1 AND user_id=$2', [req.params.eid, req.uid]);
  res.json({ ok: true });
});

module.exports = router;
