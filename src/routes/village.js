/*
 * 🌾 The village: a little town for the sprig to walk around, with a bus to town. Grown-ups use /api/village;
 * children get the same router under /api/kids/village (src/kids/village.js), so time-of-day rules apply to them.
 *   GET  /ambient          weather and the day, for the scene's little speech bubbles
 *   GET  /me               my sprig, my acorns, the bus fare, and whether my village is public
 *   POST /privacy          { public } — family can see my village only when this is on (default: private)
 *   POST /bus              { to: 'town' | 'home' } — the bus into town costs acorns; home is free
 *   POST /talk/:npc        a townsperson's lines (+ 1 acorn, once per person per character)
 *   GET  /family           the public villages of the rest of the household
 *   GET  /of/:uid          one family member's village (only if they've made it public)
 */
const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const sprig = require('../kids/sprig');
const { FARE, CHARACTERS, weather, talk, londonDay } = require('../village/town');

const router = express.Router();
const isId = (s) => /^[0-9a-f-]{36}$/i.test(String(s));
const isPublic = (settings) => !!(settings && settings.village && settings.village.public === true);

router.get('/ambient', async (req, res) => {
  const w = await weather().catch(() => null);
  res.json({ ok: true, day: londonDay(), weather: w });
});

router.get('/me', async (req, res) => {
  const { rows: [me] } = await pool.query('SELECT name, settings FROM users WHERE id=$1', [req.uid]);
  const pet = await game.getPet(req.uid);
  res.json({ ok: true, name: me ? String(me.name).trim() : '', public: isPublic(me && me.settings), fare: FARE,
    pet: pet ? { name: pet.name, acorns: pet.acorns || 0 } : null,
    characters: Object.entries(CHARACTERS).map(([id, c]) => ({ id, ...c })) });
});

router.post('/privacy', async (req, res) => {
  const on = (req.body || {}).public === true;
  // Merge rather than jsonb_set: jsonb_set won't create the 'village' key on its own, so the switch would silently do nothing.
  await pool.query(`UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('village',
      COALESCE(settings->'village', '{}'::jsonb) || jsonb_build_object('public', $2::boolean)) WHERE id=$1`, [req.uid, on]);
  res.json({ ok: true, public: on });
});

router.post('/bus', async (req, res) => {
  const to = (req.body || {}).to;
  if (to === 'home') return res.json({ ok: true, at: 'home', cost: 0 });
  if (to !== 'town') return res.status(400).json({ ok: false, error: 'Where to?' });
  const pet = await game.getPet(req.uid);
  if (!pet) return res.status(400).json({ ok: false, error: 'Hatch your sprig first, then it can catch the bus.' });
  // Take the fare in one statement so two taps can't both spend the same acorns.
  const { rows: [left] } = await pool.query(
    'UPDATE pets SET acorns = acorns - $2 WHERE user_id=$1 AND deleted_at IS NULL AND acorns >= $2 RETURNING acorns', [req.uid, FARE]);
  if (!left) return res.status(402).json({ ok: false, error: `The bus costs ${FARE} 🌰 — you have ${pet.acorns || 0}. Keep going with your jobs!` });
  await pool.query('INSERT INTO acorn_ledger(user_id, delta, reason) VALUES ($1,$2,$3)', [req.uid, -FARE, 'bus']);
  res.json({ ok: true, at: 'town', cost: FARE, acorns: left.acorns });
});

router.post('/talk/:npc', async (req, res) => {
  const c = CHARACTERS[req.params.npc];
  if (!c) return res.status(404).json({ ok: false, error: 'Nobody here by that name' });
  const pet = await game.getPet(req.uid);
  const lines = await talk(req.params.npc, { acorns: pet ? pet.acorns || 0 : null });
  const reward = pet ? await sprig.reward(req.uid, 'village_chat', req.params.npc).catch(() => ({ messages: [] })) : { messages: [] };
  res.json({ ok: true, name: c.name, emoji: c.emoji, job: c.job, lines, messages: reward.messages || [] });
});

router.get('/family', async (req, res) => {
  const { rows } = await pool.query(`SELECT u.id, u.name, p.name AS pet_name FROM users u
    LEFT JOIN pets p ON p.user_id = u.id AND p.deleted_at IS NULL
    WHERE u.id <> $1 AND u.deleted_at IS NULL AND (u.settings->'village'->>'public') = 'true' ORDER BY u.created_at`, [req.uid]);
  res.json({ ok: true, villages: rows.map((r) => ({ id: r.id, name: String(r.name).trim(), pet: r.pet_name ? { name: r.pet_name } : null })) });
});

router.get('/of/:uid', async (req, res) => {
  if (!isId(req.params.uid) || req.params.uid === req.uid) return res.status(404).json({ ok: false, error: 'No such village' });
  const { rows: [u] } = await pool.query(`SELECT u.name, u.settings, p.name AS pet_name FROM users u
    LEFT JOIN pets p ON p.user_id = u.id AND p.deleted_at IS NULL WHERE u.id=$1 AND u.deleted_at IS NULL`, [req.params.uid]);
  if (!u || !isPublic(u.settings)) return res.status(404).json({ ok: false, error: 'That village is private' });
  // Only what the owner has chosen to share: their name and their sprig's name. No balances, no chats.
  res.json({ ok: true, name: String(u.name).trim(), pet: u.pet_name ? { name: u.pet_name } : null });
});

module.exports = router;
