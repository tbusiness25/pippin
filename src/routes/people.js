/* Your people: relationship upkeep from contact metadata + your own notes. */
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const P = require('../coach/people');
const vault = require('../coach/vault');

const router = express.Router();
const RINGS = Object.keys(P.RING_CADENCE);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, p.ring, p.cadence_days, p.birthday, p.notes, p.last_sent_at, p.last_received_at, p.snoozed_until,
      COALESCE(json_agg(json_build_object('kind', h.kind, 'handle', h.handle)) FILTER (WHERE h.handle IS NOT NULL), '[]') handles
    FROM people p LEFT JOIN person_handles h ON h.person_id=p.id
    WHERE p.user_id=$1 AND p.archived_at IS NULL GROUP BY p.id ORDER BY p.name`, [req.uid]);
  res.json({ ok: true, people: rows, due: await P.due(req.uid, 8), rings: P.RING_CADENCE,
    live: await liveStatus() });
});

router.get('/unlinked', async (req, res) => res.json({ ok: true, handles: await P.unlinked(req.uid, 40) }));

const clean = (b) => ({
  name: String(b.name || '').trim().slice(0, 60),
  ring: RINGS.includes(b.ring) ? b.ring : 'friends',
  cadence_days: b.cadence_days === null || b.cadence_days === '' ? null : Math.max(1, Math.min(730, parseInt(b.cadence_days, 10) || 0)) || null,
  birthday: /^\d{2}-\d{2}$/.test(b.birthday || '') ? b.birthday : null,
  notes: b.notes ? String(b.notes).slice(0, 4000) : null,
});

router.post('/', async (req, res) => {
  const p = clean(req.body || {});
  if (!p.name) return res.status(400).json({ ok: false, error: 'Name please' });
  const cadence = p.cadence_days ?? P.RING_CADENCE[p.ring];
  const { rows } = await pool.query(
    `INSERT INTO people(user_id, name, ring, cadence_days, birthday, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.uid, p.name, p.ring, cadence, p.birthday, p.notes]);
  if (req.body.handle && req.body.kind) await link(req.uid, rows[0].id, req.body.kind, req.body.handle);
  await P.refresh(req.uid);
  vault.syncPeople(req.uid).catch(() => {});
  res.json({ ok: true, id: rows[0].id });
});

router.put('/:id', async (req, res) => {
  const p = clean(req.body || {});
  if (!p.name) return res.status(400).json({ ok: false, error: 'Name please' });
  await pool.query(`UPDATE people SET name=$3, ring=$4, cadence_days=$5, birthday=$6, notes=$7 WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.uid, p.name, p.ring, p.cadence_days, p.birthday, p.notes]);
  vault.syncPeople(req.uid).catch(() => {});
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE people SET archived_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  await pool.query('DELETE FROM person_handles WHERE person_id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

async function link(uid, personId, kind, handle) {
  await pool.query(`INSERT INTO person_handles(user_id, person_id, kind, handle) VALUES ($1,$2,$3,$4)
                    ON CONFLICT (user_id, kind, handle) DO UPDATE SET person_id=$2`, [uid, personId, kind, String(handle).slice(0, 120)]);
}
router.post('/:id/link', async (req, res) => {
  const { rows } = await pool.query('SELECT 1 FROM people WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  await link(req.uid, req.params.id, req.body.kind, req.body.handle);
  await P.refresh(req.uid);
  vault.syncPeople(req.uid).catch(() => {});
  res.json({ ok: true });
});

// "I was in touch" (call, saw them, etc.) and snooze.
router.post('/:id/touched', async (req, res) => {
  await pool.query('UPDATE people SET last_sent_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  vault.syncPeople(req.uid).catch(() => {});
  res.json({ ok: true });
});
router.post('/:id/snooze', async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt((req.body || {}).days || '7', 10)));
  await pool.query(`UPDATE people SET snoozed_until=CURRENT_DATE + $3::int WHERE id=$1 AND user_id=$2`, [req.params.id, req.uid, days]);
  res.json({ ok: true });
});

// Import aggregated contact counts (from the WhatsApp .txt parser in the app, or other importers).
// Body: {kind, rows:[{handle, display, day, sent, received}]} — counts only, never message text.
router.post('/import', async (req, res) => {
  const { kind, rows } = req.body || {};
  if (!['whatsapp', 'facebook'].includes(kind) || !Array.isArray(rows)) return res.status(400).json({ ok: false });
  await P.addContactDays(req.uid, rows.slice(0, 50000).map((r) => ({ ...r, kind })), { replace: true });
  res.json({ ok: true, days: rows.length });
});

// ---------- live WhatsApp link (pippin-whatsapp sidecar) ----------
const SIDE = process.env.WHATSAPP_SIDECAR_URL || '';
async function liveStatus() {
  if (!SIDE) return { available: false };
  try { const r = await fetch(`${SIDE}/status`, { signal: AbortSignal.timeout(3000) }); return { available: true, ...(await r.json()) }; }
  catch { return { available: true, state: 'offline' }; }
}
router.get('/whatsapp/status', async (req, res) => res.json({ ok: true, ...(await liveStatus()) }));
router.post('/whatsapp/:action', async (req, res) => {
  if (!SIDE || !['start', 'logout'].includes(req.params.action)) return res.status(400).json({ ok: false });
  const r = await fetch(`${SIDE}/${req.params.action}`, { method: 'POST', headers: { 'X-Pippin-Owner': req.uid }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  res.json({ ok: !!r && r.ok });
});

module.exports = router;
module.exports.internal = (() => {
  // The sidecar posts metadata events here: {secret, owner, events:[{handle, display, fromMe, ts}]}
  const r = express.Router();
  r.post('/contact-events', express.json({ limit: '1mb' }), async (req, res) => {
    const secret = process.env.WHATSAPP_SIDECAR_SECRET || '';
    const given = String(req.body?.secret || '');
    if (!secret || given.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return res.status(403).end();
    const { owner, events } = req.body;
    if (!/^[0-9a-f-]{36}$/.test(owner || '') || !Array.isArray(events)) return res.status(400).end();
    const { rows: u } = await pool.query('SELECT tz FROM users WHERE id=$1', [owner]);
    if (!u.length) return res.status(404).end();
    const tz = u[0].tz;
    const day = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ts));
    await P.addContactDays(owner, events.slice(0, 500).map((e) => ({
      kind: 'whatsapp', handle: e.handle, display: e.display, day: day(e.ts), sent: e.fromMe ? 1 : 0, received: e.fromMe ? 0 : 1,
    })));
    res.json({ ok: true });
  });
  return r;
})();
