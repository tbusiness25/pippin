/*
 * People on this Pippin server: household accounts, friends (by friend code), kind words,
 * visiting a friend's sprig, shared goals and gifts.
 * Privacy: friends see your sprig, its home and your shared goals — never your check-ins,
 * reflections, chat, private goals or coach plans.
 */
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const game = require('../game');
const rewards = require('../rewards');
const { hashPin } = require('../auth');
const { KINDNESSES } = require('../content');
const { item, COMPANIONS } = require('../catalog');

const router = express.Router();
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
const newCode = () => crypto.randomBytes(4).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
const FRIEND_LEVELS = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150];   // points for levels 1..10

async function ensureCode(uid) {
  const { rows } = await pool.query('SELECT friend_code FROM users WHERE id=$1', [uid]);
  if (rows[0].friend_code) return rows[0].friend_code;
  for (;;) {
    const code = newCode();
    const { rowCount } = await pool.query('UPDATE users SET friend_code=$2 WHERE id=$1 AND friend_code IS NULL', [uid, code])
      .catch(() => ({ rowCount: 0 }));
    if (rowCount) return code;
  }
}
async function areFriends(a, b) {
  const [x, y] = pair(a, b);
  const { rows } = await pool.query('SELECT points FROM friendships WHERE user_a=$1 AND user_b=$2 AND ended_at IS NULL', [x, y]);
  return rows[0] || null;
}
const level = (points) => FRIEND_LEVELS.filter((p) => points >= p).length;

// ---------- household (owner adds people to this server) ----------
router.post('/household', async (req, res) => {
  const me = await game.getUser(req.uid);
  if (!me.is_owner) return res.status(403).json({ ok: false, error: 'Only the owner can add people' });
  const { name, pin } = req.body || {};
  if (!name || !/^\d{4,8}$/.test(pin || '')) return res.status(400).json({ ok: false, error: 'Name and a 4–8 digit PIN please' });
  const { rows } = await pool.query(
    `INSERT INTO users(name, pin_hash, tz, settings) VALUES ($1,$2,$3,$4) RETURNING id`,
    [String(name).slice(0, 40), await hashPin(pin), me.tz, { streaks_enabled: true, streak_level: 'gentle' }]);
  res.json({ ok: true, id: rows[0].id });
});

// ---------- friends ----------
router.get('/friends', async (req, res) => {
  const code = await ensureCode(req.uid);
  const user = await game.getUser(req.uid);
  const today = game.localDay(user.tz);
  const { rows } = await pool.query(`
    SELECT u.id, u.name, f.points, p.name AS pet_name, p.colour, p.adventures, p.equipped,
      EXISTS (SELECT 1 FROM kindnesses k WHERE k.from_user=$1 AND k.to_user=u.id AND k.day=$2) AS sent_today
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END
    LEFT JOIN pets p ON p.user_id=u.id AND p.deleted_at IS NULL
    WHERE (f.user_a=$1 OR f.user_b=$1) AND f.ended_at IS NULL AND u.deleted_at IS NULL
    ORDER BY u.name`, [req.uid, today]);
  const { rows: inbox } = await pool.query(`
    SELECT k.id, k.kind, k.created_at, k.seen_at, u.name AS from_name FROM kindnesses k JOIN users u ON u.id=k.from_user
    WHERE k.to_user=$1 ORDER BY k.created_at DESC LIMIT 30`, [req.uid]);
  res.json({
    ok: true, code, kindnesses: KINDNESSES,
    friends: rows.map((r) => ({ ...r, level: level(r.points), stage: game.stageFor(r.adventures || 0).key })),
    inbox,
  });
});

router.post('/friends', async (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  const { rows } = await pool.query('SELECT id, name FROM users WHERE friend_code=$1 AND deleted_at IS NULL', [code]);
  if (!rows.length) return res.status(404).json({ ok: false, error: 'No one has that code' });
  if (rows[0].id === req.uid) return res.status(400).json({ ok: false, error: 'That’s your own code!' });
  const [a, b] = pair(req.uid, rows[0].id);
  await pool.query(`INSERT INTO friendships(user_a, user_b) VALUES ($1,$2)
                    ON CONFLICT (user_a, user_b) DO UPDATE SET ended_at=NULL`, [a, b]);
  res.json({ ok: true, name: rows[0].name });
});

router.delete('/friends/:id', async (req, res) => {
  const [a, b] = pair(req.uid, req.params.id);
  await pool.query('UPDATE friendships SET ended_at=NOW() WHERE user_a=$1 AND user_b=$2', [a, b]);
  res.json({ ok: true });
});

// Send kind words. One per friend per day; the first you send each day gives you +3 energy and +2 acorns.
router.post('/friends/:id/kindness', async (req, res) => {
  const k = KINDNESSES.find((x) => x.id === (req.body || {}).kind);
  if (!k) return res.status(400).json({ ok: false });
  if (!(await areFriends(req.uid, req.params.id))) return res.status(403).json({ ok: false, error: 'Not friends yet' });
  const user = await game.getUser(req.uid);
  const day = game.localDay(user.tz);
  const { rows: already } = await pool.query('SELECT 1 FROM kindnesses WHERE from_user=$1 AND to_user=$2 AND day=$3', [req.uid, req.params.id, day]);
  if (already.length) return res.status(409).json({ ok: false, error: 'You’ve already sent them something today' });
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM kindnesses WHERE from_user=$1 AND day=$2', [req.uid, day]);
  await pool.query('INSERT INTO kindnesses(from_user, to_user, kind, day) VALUES ($1,$2,$3,$4)', [req.uid, req.params.id, k.id, day]);
  const [a, b] = pair(req.uid, req.params.id);
  await pool.query('UPDATE friendships SET points=points+1 WHERE user_a=$1 AND user_b=$2', [a, b]);
  const messages = [];
  let energy = null;
  if (n === 0) {
    energy = await game.addEnergy(req.uid, 3, 'kindness');
    await game.addAcorns(req.uid, 2, 'first kind word today');
    messages.push('+3 energy, +2 🌰 for your first kind word today');
  }
  messages.push(...await rewards.onKindnessSent(req.uid));
  require('../push').notify(req.params.id, 'kindness', `${user.name}: ${k.emoji} ${k.text}`, { ref: `${req.uid}:${day}` }).catch(() => {});
  res.json({ ok: true, energy, messages });
});

router.post('/kindness/seen', async (req, res) => {
  await pool.query('UPDATE kindnesses SET seen_at=NOW() WHERE to_user=$1 AND seen_at IS NULL', [req.uid]);
  res.json({ ok: true });
});

// Visit a friend's sprig and home (read-only; nothing personal).
router.get('/friends/:id/visit', async (req, res) => {
  const f = await areFriends(req.uid, req.params.id);
  if (!f) return res.status(403).json({ ok: false, error: 'Not friends yet' });
  const { rows: [u] } = await pool.query('SELECT name FROM users WHERE id=$1', [req.params.id]);
  const p = await game.getPet(req.params.id);
  if (!p) return res.json({ ok: true, name: u.name, pet: null });
  const adv = await game.currentAdventure(p.id);
  const { rows: last } = await pool.query(
    `SELECT story->>'title' title, place FROM adventures WHERE pet_id=$1 AND returned_at IS NOT NULL ORDER BY returned_at DESC LIMIT 1`, [p.id]);
  const { rows: comps } = await pool.query('SELECT companion FROM companions WHERE user_id=$1', [req.params.id]);
  res.json({ ok: true, name: u.name, level: level(f.points), pet: {
    name: p.name, colour: p.colour, stage: game.stageFor(p.adventures).key, stageName: game.stageFor(p.adventures).name,
    equipped: p.equipped, home: p.home, adventures: p.adventures,
    away: adv && new Date(adv.ends_at) > new Date() ? adv.place : null,
    lastAdventure: last[0] || null,
    companions: comps.map((c) => COMPANIONS.find((x) => x.id === c.companion)?.name).filter(Boolean),
  } });
});

// Shared goal: the same small goal for both of you; each sees whether the other has done it today.
router.post('/friends/:id/shared-goal', async (req, res) => {
  if (!(await areFriends(req.uid, req.params.id))) return res.status(403).json({ ok: false, error: 'Not friends yet' });
  const { title, category } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ ok: false, error: 'Give it a name' });
  const sid = crypto.randomUUID();
  for (const uid of [req.uid, req.params.id]) {
    await pool.query(`INSERT INTO goals(user_id, title, category, why, source, shared_id) VALUES ($1,$2,$3,$4,'manual',$5)`,
      [uid, String(title).slice(0, 80), category || 'people', 'Shared goal', sid]);
  }
  res.json({ ok: true });
});

// Gift: buy a shop item for a friend with your acorns.
router.post('/friends/:id/gift', async (req, res) => {
  if (!(await areFriends(req.uid, req.params.id))) return res.status(403).json({ ok: false, error: 'Not friends yet' });
  const it = item((req.body || {}).item);
  if (!it || it.event) return res.status(400).json({ ok: false, error: 'That can’t be gifted' });
  const { rows: has } = await pool.query('SELECT 1 FROM inventory WHERE user_id=$1 AND item_id=$2', [req.params.id, it.id]);
  if (has.length) return res.status(409).json({ ok: false, error: 'They already have that' });
  const { rowCount } = await pool.query(
    'UPDATE pets SET acorns=acorns-$2 WHERE user_id=$1 AND deleted_at IS NULL AND acorns >= $2', [req.uid, it.price]);
  if (!rowCount) return res.status(400).json({ ok: false, error: `You need ${it.price} acorns` });
  await pool.query('INSERT INTO acorn_ledger(user_id, delta, reason) VALUES ($1,$2,$3)', [req.uid, -it.price, `gift: ${it.id}`]);
  await pool.query(`INSERT INTO inventory(user_id, item_id, source, gift_from) VALUES ($1,$2,'gift',$3)`, [req.params.id, it.id, req.uid]);
  const me = await game.getUser(req.uid);
  require('../push').notify(req.params.id, 'gift', `🎁 ${me.name} sent you a ${it.name}!`, { ref: `${req.uid}:${it.id}` }).catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
