const express = require('express');
const { pool } = require('../db');
const { signSession, setSessionCookie, clearSessionCookie, hashPin, verifyPin, readSession } = require('../auth');

const limit = require('../ratelimit');

const router = express.Router();
const keysFor = (req, uid) => [`ip:${req.ip}`, ...(uid ? [`u:${uid}`] : [])];
function tooMany(res, ms) {
  res.set('Retry-After', String(Math.ceil(ms / 1000)));
  return res.status(429).json({ ok: false, error: `Too many tries — wait ${Math.ceil(ms / 60000)} min and try again` });
}
const validPin = (p) => typeof p === 'string' && /^\d{4,8}$/.test(p);

// Tells the UI whether this is a fresh install (show setup) or needs a PIN.
router.get('/status', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY created_at');
  const sess = readSession(req);
  // With more than one person on this server, the PIN screen first asks who you are.
  res.json({ ok: true, setup: rows.length === 0, setupCode: rows.length === 0 && !!process.env.SETUP_CODE, signedIn: !!(sess && sess.uid),
    people: rows.length > 1 ? rows : [] });
});

// First-run only: create the single owner account.
router.post('/setup', async (req, res) => {
  const { name, pin, setup_code } = req.body || {};
  // Optional: if the server is reachable before first run, SETUP_CODE stops a stranger claiming it.
  if (process.env.SETUP_CODE && setup_code !== process.env.SETUP_CODE) return res.status(403).json({ ok: false, error: 'Setup code needed (see SETUP_CODE in .env)' });
  if (!validPin(pin)) return res.status(400).json({ ok: false, error: 'PIN must be 4–8 digits' });
  const { rows: existing } = await pool.query('SELECT 1 FROM users LIMIT 1');
  if (existing.length) return res.status(409).json({ ok: false, error: 'already set up' });
  const { rows } = await pool.query(
    `INSERT INTO users(name, pin_hash, tz, settings, is_owner) VALUES ($1,$2,$3,$4,true) RETURNING id`,
    [String(name || 'Friend').slice(0, 40), await hashPin(pin), process.env.TZ_DEFAULT || 'Europe/London',
      { streaks_enabled: true, streak_level: 'gentle' }]);
  setSessionCookie(req, res, signSession(rows[0].id));
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const { pin } = req.body || {};
  const user_id = /^[0-9a-f-]{36}$/i.test((req.body || {}).user_id || '') ? req.body.user_id : null;
  if (!validPin(pin)) return res.status(400).json({ ok: false, error: 'Enter your PIN' });
  const keys = keysFor(req, user_id);
  const wait = limit.lockedFor(keys);
  if (wait) return tooMany(res, wait);
  const { rows } = user_id
    ? await pool.query('SELECT id, pin_hash FROM users WHERE id=$1 AND deleted_at IS NULL', [user_id])
    : await pool.query('SELECT id, pin_hash FROM users WHERE deleted_at IS NULL');
  for (const u of rows) {
    if (await verifyPin(pin, u.pin_hash)) {
      limit.ok(keys);
      setSessionCookie(req, res, signSession(u.id));
      return res.json({ ok: true });
    }
  }
  limit.fail(keys);
  await new Promise((r) => setTimeout(r, 800));   // slow down guessing
  res.status(401).json({ ok: false, error: 'That PIN didn’t match' });
});

// App lock: re-check the signed-in person's PIN without issuing a new session.
router.post('/verify-pin', async (req, res) => {
  const sess = readSession(req);
  const { pin } = req.body || {};
  if (!sess?.uid || !validPin(pin)) return res.status(401).json({ ok: false, error: 'Enter your PIN' });
  const keys = keysFor(req, sess.uid);
  const wait = limit.lockedFor(keys);
  if (wait) return tooMany(res, wait);
  const { rows } = await pool.query('SELECT pin_hash FROM users WHERE id=$1', [sess.uid]);
  if (rows.length && await verifyPin(pin, rows[0].pin_hash)) { limit.ok(keys); return res.json({ ok: true }); }
  limit.fail(keys);
  await new Promise((r) => setTimeout(r, 800));
  res.status(401).json({ ok: false, error: 'That PIN didn’t match' });
});

// Change your own PIN (needs the current one; same lockout as login).
router.post('/change-pin', async (req, res) => {
  const sess = readSession(req);
  const { pin, new_pin } = req.body || {};
  if (!sess?.uid) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!validPin(new_pin)) return res.status(400).json({ ok: false, error: 'New PIN must be 4–8 digits' });
  const keys = keysFor(req, sess.uid);
  const wait = limit.lockedFor(keys);
  if (wait) return tooMany(res, wait);
  const { rows } = await pool.query('SELECT pin_hash FROM users WHERE id=$1 AND deleted_at IS NULL', [sess.uid]);
  if (!rows.length || !validPin(pin) || !(await verifyPin(pin, rows[0].pin_hash))) {
    limit.fail(keys);
    return res.status(401).json({ ok: false, error: 'Your current PIN didn’t match' });
  }
  limit.ok(keys);
  await pool.query('UPDATE users SET pin_hash=$2 WHERE id=$1', [sess.uid, await hashPin(new_pin)]);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

module.exports = router;
