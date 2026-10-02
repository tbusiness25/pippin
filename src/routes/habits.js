/*
 * Habit tracker. Research: docs/research/reports/Habit and sobriety tracker design.md
 *  - every habit is an if-then: "After I <anchor>, I will <tiny>" (+ optional barrier plan)
 *  - flexible "X per week" targets; planned skip days never count as misses
 *  - headline = habit strength (Loop's exponential score) — rises slowly, a miss only dents it
 *  - optional "weeks on target", never announced when broken; no red Xs, no reset
 *  - cap of 3 "building" habits; extras go to a parking lot
 */
const express = require('express');
const { pool } = require('../db');
const game = require('../game');

const router = express.Router();
const MAX_BUILDING = 3;
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

function addDays(day, n) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const mondayOf = (day) => { const d = new Date(day + 'T12:00:00Z'); return addDays(day, -((d.getUTCDay() + 6) % 7)); };

/** Loop Habit Tracker's strength score: multiplier = 0.5^(sqrt(freq)/13), freq = target per day. */
function strength(createdDay, today, logs, perWeek) {
  const m = Math.pow(0.5, Math.sqrt(perWeek / 7) / 13);
  let score = 0;
  for (let d = createdDay; d <= today; d = addDays(d, 1)) {
    const st = logs[d];
    if (st === 'skip') continue;                  // planned rest day: no change
    const done = st === 'done' || st === 'mini' ? 1 : 0;
    if (d === today && !done) continue;           // today isn't a miss until it's over
    score = score * m + done * (1 - m);
  }
  return Math.round(score * 100);
}

async function summary(uid, h, today) {
  const { rows } = await pool.query('SELECT day::text, status FROM habit_logs WHERE habit_id=$1 AND day >= $2', [h.id, addDays(today, -400)]);
  const logs = Object.fromEntries(rows.map((r) => [r.day, r.status]));
  const created = new Date(h.created_at).toISOString().slice(0, 10);
  const wk = mondayOf(today);
  const thisWeek = rows.filter((r) => r.day >= wk && r.status !== 'skip').length;
  // Weeks on target (optional, forgiving): consecutive complete past weeks meeting the target.
  let weeksOnTarget = 0;
  for (let w = addDays(wk, -7); w >= mondayOf(created); w = addDays(w, -7)) {
    const n = rows.filter((r) => r.day >= w && r.day < addDays(w, 7) && r.status !== 'skip').length;
    if (n >= h.per_week) weeksOnTarget++; else break;
  }
  const last14 = Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); return { day: d, status: logs[d] || null }; });
  return { ...h, today: logs[today] || null, yesterday: logs[addDays(today, -1)] || null,
    strength: strength(created, today, logs, h.per_week), thisWeek, weeksOnTarget, last14 };
}

router.get('/', async (req, res) => {
  const user = await game.getUser(req.uid);
  const today = game.localDay(user.tz);
  const { rows } = await pool.query(`SELECT * FROM habits WHERE user_id=$1 AND status <> 'archived' ORDER BY status, sort, created_at`, [req.uid]);
  const habits = await Promise.all(rows.map((h) => summary(req.uid, h, today)));
  res.json({ ok: true, habits, today, maxBuilding: MAX_BUILDING, freshStart: new Date(today + 'T12:00:00Z').getUTCDay() === 1 || today.endsWith('-01') });
});

const clean = (b) => ({
  title: String(b.title || '').trim().slice(0, 60),
  anchor: b.anchor ? String(b.anchor).slice(0, 120) : null,
  tiny: b.tiny ? String(b.tiny).slice(0, 120) : null,
  barrier: b.barrier ? String(b.barrier).slice(0, 120) : null,
  backup: b.backup ? String(b.backup).slice(0, 120) : null,
  pair_with: b.pair_with ? String(b.pair_with).slice(0, 120) : null,
  per_week: Math.max(1, Math.min(7, parseInt(b.per_week, 10) || 4)),
  remind_at: /^([01]\d|2[0-3]):[0-5]\d$/.test(b.remind_at || '') ? b.remind_at : null,
  remind_days: Array.isArray(b.remind_days) ? b.remind_days.map(Number).filter((d) => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],
  instead_for: /^[0-9a-f-]{36}$/.test(b.instead_for || '') ? b.instead_for : null,
});

router.post('/', async (req, res) => {
  const h = clean(req.body || {});
  if (!h.title) return res.status(400).json({ ok: false, error: 'Give it a short name' });
  const { rows: [{ n }] } = await pool.query(`SELECT COUNT(*)::int n FROM habits WHERE user_id=$1 AND status='building'`, [req.uid]);
  const status = n >= MAX_BUILDING && !req.body.force ? 'parked' : 'building';
  const { rows } = await pool.query(
    `INSERT INTO habits(user_id, title, anchor, tiny, barrier, backup, pair_with, per_week, remind_at, remind_days, instead_for, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [req.uid, h.title, h.anchor, h.tiny, h.barrier, h.backup, h.pair_with, h.per_week, h.remind_at, h.remind_days, h.instead_for, status]);
  res.json({ ok: true, id: rows[0].id, status,
    note: status === 'parked' ? `You’re already building ${MAX_BUILDING} habits, so this one is parked for now — swap it in whenever you like.` : null });
});

router.put('/:id', async (req, res) => {
  const h = clean(req.body || {});
  if (!h.title) return res.status(400).json({ ok: false, error: 'Give it a short name' });
  await pool.query(`UPDATE habits SET title=$3, anchor=$4, tiny=$5, barrier=$6, backup=$7, pair_with=$8, per_week=$9, remind_at=$10, remind_days=$11, instead_for=$12
                    WHERE id=$1 AND user_id=$2`, [req.params.id, req.uid, h.title, h.anchor, h.tiny, h.barrier, h.backup, h.pair_with, h.per_week, h.remind_at, h.remind_days, h.instead_for]);
  res.json({ ok: true });
});

router.post('/:id/status', async (req, res) => {
  const st = (req.body || {}).status;
  if (!['building', 'parked', 'archived'].includes(st)) return res.status(400).json({ ok: false });
  await pool.query('UPDATE habits SET status=$3 WHERE id=$1 AND user_id=$2', [req.params.id, req.uid, st]);
  res.json({ ok: true });
});

// Log today (or backfill up to 7 days, no penalty). status: done | mini | skip | clear
router.post('/:id/log', async (req, res) => {
  const user = await game.getUser(req.uid);
  const today = game.localDay(user.tz);
  const b = req.body || {};
  const day = isDay(b.day) ? b.day : today;
  if (day > today || day < addDays(today, -7)) return res.status(400).json({ ok: false, error: 'You can log today or the last week' });
  const { rows: h } = await pool.query('SELECT id, title FROM habits WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  if (!h.length) return res.status(404).json({ ok: false });
  if (b.status === 'clear') {
    await pool.query('DELETE FROM habit_logs WHERE habit_id=$1 AND day=$2', [req.params.id, day]);
    return res.json({ ok: true });
  }
  if (!['done', 'mini', 'skip'].includes(b.status)) return res.status(400).json({ ok: false });
  const { rows } = await pool.query(
    `INSERT INTO habit_logs(habit_id, user_id, day, status) VALUES ($1,$2,$3,$4)
     ON CONFLICT (habit_id, day) DO UPDATE SET status=EXCLUDED.status RETURNING (xmax = 0) AS inserted`,
    [req.params.id, req.uid, day, b.status]);
  let energy = null;
  // First completion of a habit on a day feeds the sprig (the immediate reward the research recommends).
  if (rows[0].inserted && b.status !== 'skip' && day === today) energy = await game.addEnergy(req.uid, 3, 'habit');
  res.json({ ok: true, energy });
});

module.exports = router;
module.exports.strength = strength;
