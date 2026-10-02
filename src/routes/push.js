const express = require('express');
const { pool } = require('../db');
const push = require('../push');

const router = express.Router();
const validTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

router.get('/key', (req, res) => res.json({ ok: true, key: push.getPublicKey() }));

router.post('/subscribe', async (req, res) => {
  const sub = (req.body || {}).subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({ ok: false });
  await pool.query(`INSERT INTO push_subscriptions(user_id, endpoint, keys) VALUES ($1,$2,$3)
                    ON CONFLICT (endpoint) DO UPDATE SET user_id=$1, keys=$3`, [req.uid, sub.endpoint, sub.keys]);
  await pool.query(`UPDATE users SET settings = settings || '{"nudges": true}'::jsonb WHERE id=$1`, [req.uid]);
  res.json({ ok: true });
});

router.post('/settings', async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (typeof b.nudges === 'boolean') patch.nudges = b.nudges;
  if (validTime(b.morning_time)) patch.morning_time = b.morning_time;
  if (validTime(b.evening_time)) patch.evening_time = b.evening_time;
  if (validTime(b.pledge_time)) patch.pledge_time = b.pledge_time;
  if (validTime(b.sober_time)) patch.sober_time = b.sober_time;
  if (b.push_cap != null) patch.push_cap = Math.max(1, Math.min(12, parseInt(b.push_cap, 10) || 4));
  if (b.quiet_today === true) { const u = await require('../game').getUser(req.uid); patch.quiet_day = require('../game').localDay(u.tz); }
  if (b.quiet_today === false) patch.quiet_day = null;
  await pool.query('UPDATE users SET settings = settings || $2::jsonb WHERE id=$1', [req.uid, JSON.stringify(patch)]);
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const n = await push.notify(req.uid, 'test', 'Nudges are working. 🌱', { ref: String(Date.now()) });
  res.json({ ok: true, devices: n });
});

module.exports = router;
