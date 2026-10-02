/* Safety plan, what the coach knows, export and wipe. */
const express = require('express');
const { pool } = require('../db');
const engine = require('../coach/engine');
const crisis = require('../coach/crisis');
const { decrypt } = require('../coach/crypto');

const router = express.Router();

router.get('/safety', async (req, res) => {
  const { rows } = await pool.query('SELECT settings FROM users WHERE id=$1', [req.uid]);
  res.json({ ok: true, plan: (rows[0].settings || {}).safety_plan || {}, resources: crisis.resources() });
});
router.post('/safety', async (req, res) => {
  const b = req.body || {};
  const plan = {};
  for (const k of ['person', 'person_phone', 'gp', 'gp_phone', 'warning_signs', 'helps', 'reasons']) if (b[k]) plan[k] = String(b[k]).slice(0, 600);
  await pool.query(`UPDATE users SET settings = settings || jsonb_build_object('safety_plan', $2::jsonb) WHERE id=$1`, [req.uid, JSON.stringify(plan)]);
  res.json({ ok: true });
});

router.get('/profile', async (req, res) => res.json({ ok: true, profile: await engine.profileOf(req.uid) }));
router.delete('/profile', async (req, res) => {
  await pool.query('DELETE FROM coach_profile WHERE user_id=$1', [req.uid]);
  res.json({ ok: true });
});

// Everything the coach holds about you, decrypted, as one JSON download.
router.get('/export', async (req, res) => {
  const q = (sql) => pool.query(sql, [req.uid]).then((r) => r.rows);
  const msgs = await q('SELECT role, body_enc, flow, created_at FROM coach_messages WHERE user_id=$1 ORDER BY id');
  const data = {
    exported_at: new Date().toISOString(),
    profile: await engine.profileOf(req.uid),
    coach_messages: msgs.map((m) => { try { return { ...m, body_enc: undefined, body: decrypt(m.body_enc) }; } catch { return null; } }).filter(Boolean),
    commitments: await q('SELECT * FROM commitments WHERE user_id=$1'),
    inbox: await q('SELECT * FROM inbox_items WHERE user_id=$1'),
    memories: await q('SELECT * FROM memories WHERE user_id=$1'),
    people: await q('SELECT * FROM people WHERE user_id=$1'),
    checkins: await q('SELECT * FROM checkins WHERE user_id=$1'),
    reflections: await q('SELECT * FROM reflections WHERE user_id=$1 AND deleted_at IS NULL'),
  };
  res.setHeader('Content-Disposition', `attachment; filename="pippin-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

// Wipe the coach conversation (and optionally the profile). Requires typing WIPE.
router.post('/wipe', async (req, res) => {
  if ((req.body || {}).confirm !== 'WIPE') return res.status(400).json({ ok: false, error: 'Type WIPE to confirm' });
  await pool.query('DELETE FROM coach_messages WHERE user_id=$1', [req.uid]);
  if (req.body.profile) await pool.query('DELETE FROM coach_profile WHERE user_id=$1', [req.uid]);
  res.json({ ok: true });
});

module.exports = router;
