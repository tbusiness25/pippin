const express = require('express');
const { pool } = require('../db');
const game = require('../game');

const router = express.Router();
const LEVELS = ['gentle', 'steady', 'keen', 'blazing'];   // how many actions the person aims for each day

async function patchSettings(uid, patch) {
  await pool.query('UPDATE users SET settings = settings || $2::jsonb WHERE id=$1', [uid, JSON.stringify(patch)]);
}

router.post('/settings', async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (typeof b.enabled === 'boolean') patch.streaks_enabled = b.enabled;
  if (LEVELS.includes(b.level)) patch.streak_level = b.level;
  await patchSettings(req.uid, patch);
  res.json({ ok: true, streak: await game.streak(req.uid) });
});

// Pause: from today, missed days neither break nor extend the streak. Resume clears it.
router.post('/pause', async (req, res) => {
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  await patchSettings(req.uid, { paused_from: day });
  await pool.query(`INSERT INTO streak_events(user_id, kind, day) VALUES ($1,'pause',$2)`, [req.uid, day]);
  res.json({ ok: true, streak: await game.streak(req.uid) });
});
router.post('/resume', async (req, res) => {
  const user = await game.getUser(req.uid);
  await pool.query(`UPDATE users SET settings = settings - 'paused_from' WHERE id=$1`, [req.uid]);
  await pool.query(`INSERT INTO streak_events(user_id, kind, day) VALUES ($1,'resume',$2)`, [req.uid, game.localDay(user.tz)]);
  res.json({ ok: true, streak: await game.streak(req.uid) });
});

// Mend a short gap (≤3 days). First repair each month is free.
router.post('/repair', async (req, res) => {
  const s = await game.streak(req.uid);
  if (!s.enabled || !s.repairable) return res.status(400).json({ ok: false, error: 'Nothing to mend' });
  const pet = await game.getPet(req.uid);
  if (s.repairable.cost && (!pet || pet.acorns < s.repairable.cost)) {
    return res.status(400).json({ ok: false, error: `Mending costs ${s.repairable.cost} acorns this time` });
  }
  for (const d of s.repairable.days) {
    await pool.query(`INSERT INTO streak_events(user_id, kind, day) VALUES ($1,'repair',$2)`, [req.uid, d]);
  }
  if (s.repairable.cost) await game.addAcorns(req.uid, -s.repairable.cost, 'streak repair');
  res.json({ ok: true, streak: await game.streak(req.uid) });
});

module.exports = router;
