const express = require('express');
const { pool } = require('../db');
const game = require('../game');

const router = express.Router();

// Emotion words people can tap. Deliberately plain and non-clinical.
const EMOTIONS = {
  good: ['calm', 'happy', 'proud', 'hopeful', 'grateful', 'focused', 'loved', 'energised'],
  hard: ['tired', 'anxious', 'overwhelmed', 'sad', 'frustrated', 'lonely', 'scattered', 'numb'],
};

router.get('/options', (req, res) => res.json({ ok: true, emotions: EMOTIONS }));

// kind: morning | evening. One of each per day earns energy; saving again just updates it.
router.post('/', async (req, res) => {
  const b = req.body || {};
  const kind = b.kind === 'evening' ? 'evening' : 'morning';
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  const clamp = (v) => (v == null ? null : Math.max(1, Math.min(5, Number(v))));
  const emotions = Array.isArray(b.emotions) ? b.emotions.map(String).slice(0, 8) : [];
  const { rows: existing } = await pool.query(
    'SELECT id FROM checkins WHERE user_id=$1 AND day=$2 AND kind=$3', [req.uid, day, kind]);
  if (existing.length) {
    await pool.query('UPDATE checkins SET mood=$2, energy=$3, emotions=$4, note=$5, gratitude=$6 WHERE id=$1',
      [existing[0].id, clamp(b.mood), clamp(b.energy), emotions, b.note || null, b.gratitude || null]);
    return res.json({ ok: true, energy: null });
  }
  await pool.query(
    `INSERT INTO checkins(user_id, kind, day, mood, energy, emotions, note, gratitude)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.uid, kind, day, clamp(b.mood), clamp(b.energy), emotions, b.note || null, b.gratitude || null]);
  const energy = await game.addEnergy(req.uid,
    kind === 'morning' ? game.ENERGY.morningCheckin : game.ENERGY.eveningCheckin, `${kind} check-in`);
  // A very low mood gets a gentle pointer to real support alongside the usual flow.
  const support = clamp(b.mood) === 1 || emotions.includes('numb');
  res.json({ ok: true, energy, support });
});

module.exports = router;
