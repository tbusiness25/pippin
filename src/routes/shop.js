const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const { ITEMS, COMPANIONS, item, activeEvent } = require('../catalog');

const router = express.Router();
const SLOTS = ['wall', 'window', 'floorL', 'floorR', 'rug', 'ceiling'];

async function owned(uid) {
  const { rows } = await pool.query('SELECT item_id, source, gift_from FROM inventory WHERE user_id=$1', [uid]);
  return rows;
}

router.get('/', async (req, res) => {
  const user = await game.getUser(req.uid);
  const pet = await game.getPet(req.uid);
  const ev = activeEvent(game.localDay(user.tz));
  const { rows: tok } = ev ? await pool.query('SELECT tokens FROM event_tokens WHERE user_id=$1 AND event=$2', [req.uid, ev.id]) : { rows: [] };
  const mine = await owned(req.uid);
  const { rows: comps } = await pool.query('SELECT companion FROM companions WHERE user_id=$1', [req.uid]);
  res.json({
    ok: true,
    acorns: pet?.acorns || 0,
    event: ev && { ...ev, tokens: tok[0]?.tokens || 0 },
    // Event items only show while their event runs (or if you already own them).
    items: ITEMS.filter((i) => !i.event || (ev && i.event === ev.id) || mine.some((m) => m.item_id === i.id)),
    owned: mine.map((m) => m.item_id),
    equipped: pet?.equipped || {}, home: pet?.home || {},
    companions: COMPANIONS.map((c) => ({ ...c, owned: comps.some((x) => x.companion === c.id) })),
  });
});

router.post('/buy/:id', async (req, res) => {
  const it = item(req.params.id);
  if (!it) return res.status(404).json({ ok: false, error: 'No such item' });
  if ((await owned(req.uid)).some((m) => m.item_id === it.id)) return res.status(409).json({ ok: false, error: 'You already have that' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (it.event) {
      const user = await game.getUser(req.uid);
      const ev = activeEvent(game.localDay(user.tz));
      if (!ev || ev.id !== it.event) throw new Error('That event has finished');
      const { rowCount } = await client.query(
        'UPDATE event_tokens SET tokens = tokens - $3 WHERE user_id=$1 AND event=$2 AND tokens >= $3', [req.uid, ev.id, it.price]);
      if (!rowCount) throw new Error(`You need ${it.price} ${ev.token}`);
    } else {
      const { rowCount } = await client.query(
        'UPDATE pets SET acorns = acorns - $2 WHERE user_id=$1 AND deleted_at IS NULL AND acorns >= $2', [req.uid, it.price]);
      if (!rowCount) throw new Error(`You need ${it.price} acorns`);
      await client.query('INSERT INTO acorn_ledger(user_id, delta, reason) VALUES ($1,$2,$3)', [req.uid, -it.price, `shop: ${it.id}`]);
    }
    await client.query('INSERT INTO inventory(user_id, item_id, source) VALUES ($1,$2,$3)', [req.uid, it.id, it.event ? 'event' : 'shop']);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ ok: false, error: e.message });
  } finally { client.release(); }
});

// Wear / unwear. body: {slot: hat|neck|face|colour|companion, id|null}
router.post('/equip', async (req, res) => {
  const { slot, id } = req.body || {};
  const pet = await game.getPet(req.uid);
  if (!pet) return res.status(400).json({ ok: false });
  const eq = { ...pet.equipped };
  if (slot === 'companion') {
    if (id) {
      const { rows } = await pool.query('SELECT 1 FROM companions WHERE user_id=$1 AND companion=$2', [req.uid, id]);
      if (!rows.length) return res.status(400).json({ ok: false, error: 'Not yours yet' });
    }
    eq.companion = id || null;
  } else if (['hat', 'neck', 'face', 'colour'].includes(slot)) {
    if (id) {
      const it = item(id);
      if (!it || it.type !== slot || !(await owned(req.uid)).some((m) => m.item_id === id)) return res.status(400).json({ ok: false, error: 'Not yours yet' });
    }
    eq[slot] = id || null;
  } else return res.status(400).json({ ok: false });
  await pool.query('UPDATE pets SET equipped=$2 WHERE id=$1', [pet.id, eq]);
  res.json({ ok: true, equipped: eq });
});

// Place furniture. body: {slot: wall|window|…, id|null}
router.post('/place', async (req, res) => {
  const { slot, id } = req.body || {};
  if (!SLOTS.includes(slot)) return res.status(400).json({ ok: false });
  const pet = await game.getPet(req.uid);
  if (id) {
    const it = item(id);
    if (!it || it.type !== 'furniture' || it.slot !== slot || !(await owned(req.uid)).some((m) => m.item_id === id)) {
      return res.status(400).json({ ok: false, error: 'That doesn’t go there' });
    }
  }
  const home = { ...pet.home, [slot]: id || null };
  await pool.query('UPDATE pets SET home=$2 WHERE id=$1', [pet.id, home]);
  res.json({ ok: true, home });
});

module.exports = router;
