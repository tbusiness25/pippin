const express = require('express');
const { pool } = require('../db');
const { signSession, setSessionCookie, clearSessionCookie, hashPin, verifyPin, readSession } = require('../auth');

const limit = require('../ratelimit');
const { hintedUser } = require('../household');

const router = express.Router();
const keysFor = (req, uid) => [`ip:${req.ip}`, ...(uid ? [`u:${uid}`] : [])];
function tooMany(res, ms) {
  res.set('Retry-After', String(Math.ceil(ms / 1000)));
  return res.status(429).json({ ok: false, error: `Too many tries — wait ${Math.ceil(ms / 60000)} min and try again` });
}
const validPin = (p) => typeof p === 'string' && /^\d{4,8}$/.test(p);

// Tells the UI whether this is a fresh install (show setup) or needs a PIN.
// With more than one person on this server, the PIN screen asks who you are — unless the host
// this was opened on is tied to one person (HOST_USERS), in which case that person is preselected.
router.get('/status', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, role FROM users WHERE deleted_at IS NULL ORDER BY created_at`);
  const sess = readSession(req);
  const hint = rows.length > 1 ? await hintedUser(req).catch(() => null) : null;
  res.json({ ok: true, setup: rows.length === 0, setupCode: rows.length === 0 && !!process.env.SETUP_CODE, signedIn: !!(sess && sess.uid),
    people: rows.length > 1 ? rows : [], hint: hint ? { id: hint.id, name: hint.name, role: hint.role } : null });
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
  let user_id = /^[0-9a-f-]{36}$/i.test((req.body || {}).user_id || '') ? req.body.user_id : null;
  if (!validPin(pin)) return res.status(400).json({ ok: false, error: 'Enter your PIN' });
  // A PIN is only ever checked against ONE person: the one chosen, else the one this host is tied to,
  // else the only person on the server. Never "whoever's PIN happens to match first".
  if (!user_id) {
    const hint = await hintedUser(req).catch(() => null);
    if (hint) user_id = hint.id;
    else {
      const { rows: all } = await pool.query('SELECT id FROM users WHERE deleted_at IS NULL LIMIT 2');
      if (all.length === 1) user_id = all[0].id;
      else return res.status(400).json({ ok: false, error: 'Choose who you are first', choose: true });
    }
  }
  const keys = keysFor(req, user_id);
  const wait = limit.lockedFor(keys);
  if (wait) return tooMany(res, wait);
  const { rows } = await pool.query('SELECT id, pin_hash FROM users WHERE id=$1 AND deleted_at IS NULL', [user_id]);
  if (rows.length && await verifyPin(pin, rows[0].pin_hash)) {
    limit.ok(keys);
    setSessionCookie(req, res, signSession(rows[0].id));
    return res.json({ ok: true });
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
// A parent sets someone else's PIN (e.g. a child who forgot it, or the other adult). The parent must confirm with
// their OWN current PIN, so an unlocked phone alone can't reset anyone.
router.post('/set-pin/:uid', async (req, res) => {
  const sess = readSession(req);
  const { my_pin, new_pin } = req.body || {};
  if (!sess?.uid) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!validPin(new_pin)) return res.status(400).json({ ok: false, error: 'New PIN must be 4–8 digits' });
  const keys = keysFor(req, sess.uid);
  const wait = limit.lockedFor(keys);
  if (wait) return tooMany(res, wait);
  const { rows: [me] } = await pool.query('SELECT pin_hash, is_parent FROM users WHERE id=$1 AND deleted_at IS NULL', [sess.uid]);
  if (!me || !me.is_parent) return res.status(403).json({ ok: false, error: 'Only a parent can change someone else’s PIN' });
  if (!validPin(my_pin) || !(await verifyPin(my_pin, me.pin_hash))) {
    limit.fail(keys);
    return res.status(401).json({ ok: false, error: 'Your own PIN didn’t match' });
  }
  limit.ok(keys);
  const { rows: [target] } = await pool.query('SELECT id, name, role FROM users WHERE id=$1 AND deleted_at IS NULL', [req.params.uid]);
  if (!target) return res.status(404).json({ ok: false, error: 'Not found' });
  // Parents reset a child's PIN only. Another adult changes their own (/change-pin), so one parent can't lock out another.
  if (target.role !== 'child') return res.status(403).json({ ok: false, error: 'A parent can only reset a child’s PIN' });
  await pool.query('UPDATE users SET pin_hash=$2 WHERE id=$1', [target.id, await hashPin(new_pin)]);
  console.log(`[auth] PIN for ${String(target.name).trim()} set by a parent`);
  res.json({ ok: true, name: String(target.name).trim() });
});

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
