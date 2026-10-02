const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const { CATEGORIES } = require('../brains/prompts');
const rewards = require('../rewards');
const { completeGoal } = require('../goalDone');
const checks = require('../agentChecks');

const router = express.Router();

// Starter ideas, grouped. Written for ADHD brains: small, concrete, forgiving.
const SUGGESTIONS = {
  body: ['Drink a glass of water', 'Take your meds', 'Eat something with protein', 'Step outside for 5 minutes', 'Stretch for 2 minutes'],
  mind: ['Write down 3 things on your mind', 'Do one breathing exercise', 'Put your phone in another room for 20 min'],
  home: ['Clear one surface', 'Put one load of washing on', 'Take the bins out', '5-minute tidy with a timer'],
  people: ['Text someone you like', 'Reply to one message you\'ve been avoiding', 'Call a family member'],
  work: ['Pick your one most important task', 'Open the thing you\'re avoiding for 2 minutes', 'Clear 5 emails'],
  money: ['Check your bank balance', 'Cancel one subscription you don\'t use', 'Pay one bill'],
  admin: ['Book that appointment', 'Put one date in the calendar', 'File one piece of paper'],
  fun: ['Do something just because you enjoy it', 'Listen to a song you love', 'Draw or doodle for 5 minutes'],
  rest: ['Go to bed 15 minutes earlier', 'Have a proper lunch break', 'Sit quietly for 3 minutes'],
};

const clean = (b) => ({
  title: String(b.title || '').trim().slice(0, 80),
  category: CATEGORIES.includes(b.category) ? b.category : 'general',
  days: Array.isArray(b.days) ? b.days.map(Number).filter((d) => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],
  once_on: b.once_on || null,
  agent_check: b.agent_check ? String(b.agent_check).trim().slice(0, 300) || null : null,
  agent_check_after: /^\d{1,2}:\d{2}$/.test(b.agent_check_after || '') ? b.agent_check_after : null,
  steps: Array.isArray(b.steps) ? b.steps.slice(0, 8).map((s) => ({ text: String(s.text ?? s).slice(0, 120), done: !!s.done })) : [],
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, category, days, once_on, steps, why, source, agent_check, to_char(agent_check_after, 'HH24:MI') AS agent_check_after
     FROM goals WHERE user_id=$1 AND deleted_at IS NULL ORDER BY sort, created_at`, [req.uid]);
  const last = await checks.lastChecks(req.uid);
  for (const g of rows) g.last_check = last[g.id] || null;
  res.json({ ok: true, goals: rows, categories: CATEGORIES, suggestions: SUGGESTIONS, agentChecks: checks.available() });
});

router.post('/', async (req, res) => {
  const g = clean(req.body || {});
  if (!g.title) return res.status(400).json({ ok: false, error: 'Give the goal a name' });
  const { rows } = await pool.query(
    `INSERT INTO goals(user_id, title, category, days, once_on, steps, why, source, agent_check, agent_check_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [req.uid, g.title, g.category, g.days, g.once_on, JSON.stringify(g.steps),
      req.body.why || null, ['coach', 'suggestion'].includes(req.body.source) ? req.body.source : 'manual', g.agent_check, g.agent_check_after]);
  res.json({ ok: true, id: rows[0].id });
});

router.put('/:id', async (req, res) => {
  const g = clean(req.body || {});
  if (!g.title) return res.status(400).json({ ok: false, error: 'Give the goal a name' });
  await pool.query(
    `UPDATE goals SET title=$3, category=$4, days=$5, once_on=$6, steps=$7, agent_check=$8, agent_check_after=$9
     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
    [req.params.id, req.uid, g.title, g.category, g.days, g.once_on, JSON.stringify(g.steps), g.agent_check, g.agent_check_after]);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE goals SET deleted_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

// Tick / untick a tiny step. No energy — steps are scaffolding, the goal is the win.
router.post('/:id/steps/:i', async (req, res) => {
  const { rows } = await pool.query('SELECT steps FROM goals WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  const steps = rows[0].steps;
  const i = Number(req.params.i);
  if (!steps[i]) return res.status(400).json({ ok: false });
  steps[i].done = !steps[i].done;
  await pool.query('UPDATE goals SET steps=$2 WHERE id=$1', [req.params.id, JSON.stringify(steps)]);
  res.json({ ok: true, steps });
});

// Complete for today. Energy only the first time a goal is completed on a given day.
router.post('/:id/complete', async (req, res) => {
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  const { rows: g } = await pool.query('SELECT id FROM goals WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [req.params.id, req.uid]);
  if (!g.length) return res.status(404).json({ ok: false });
  const { energy, messages } = await completeGoal(req.uid, req.params.id, day);
  res.json({ ok: true, energy, messages });
});

// Ask the agent now (runs in the background; the screen refreshes from GET /).
router.post('/:id/check', async (req, res) => {
  if (!checks.available()) return res.status(400).json({ ok: false, error: 'No agent connected (BRAIN=hermes or BRAIN=agent)' });
  const { rows } = await pool.query('SELECT id FROM goals WHERE id=$1 AND user_id=$2 AND agent_check IS NOT NULL AND deleted_at IS NULL', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  checks.checkNow(req.uid, req.params.id);
  res.json({ ok: true, pending: true });
});

router.post('/:id/uncomplete', async (req, res) => {
  const user = await game.getUser(req.uid);
  await pool.query('UPDATE goal_completions SET undone=true WHERE goal_id=$1 AND user_id=$2 AND day=$3',
    [req.params.id, req.uid, game.localDay(user.tz)]);
  res.json({ ok: true });
});

module.exports = router;
