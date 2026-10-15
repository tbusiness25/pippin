/*
 * Audio library — for ANY person: a child's stories and audio, an adult's own audio.
 *
 * Files live under LIBRARY_DIR/<userId>/ (default /data/library). audio_path keeps the old form
 * '/static/audio/<sub>/<file>' (or '<sub>/<file>') and is resolved under the owner's folder, so a TTS
 * service that writes into <that folder>/<sub>/ and an automation that records '/static/audio/<sub>/<id>.mp3'
 * keep working unchanged. Audio is only ever served to its owner, or to a parent for a child's items.
 *
 * New items wait for approval (approved=false) unless the creator approves them. Rejecting is a soft
 * delete: the row keeps its reason and the file is left where it is.
 *
 *   /api/kids/library…        child (or parent with ?child=) — listen, and for parents approve/reject
 *   /api/family/library…      an adult's own library
 *   /hooks/:slug/api/admin/audio…   automations (same JSON as the old content admin API)
 */
const fs = require('fs');
const path = require('path');

const LIB_ROOT = process.env.LIBRARY_DIR || '/data/library';
const KIND_RE = /^[a-z][a-z0-9_]{0,31}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIO_TYPES = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.aac': 'audio/aac' };

/** '/static/audio/shows/x.mp3' | 'shows/x.mp3' → 'shows/x.mp3' (null if it tries to escape). */
function relOf(p) {
  let r = String(p || '').trim();
  if (!r || /^[a-z]+:\/\//i.test(r)) return null;
  r = r.replace(/^\/?static\/audio\//, '').replace(/^\/+/, '');
  const n = path.posix.normalize(r);
  if (!n || n === '.' || n.startsWith('..') || n.includes('\0')) return null;
  return n;
}
const userRoot = (userId) => path.join(LIB_ROOT, String(userId));
/** Absolute file for an audio_path in a person's library, or null. */
function fileFor(userId, audioPath) {
  const rel = relOf(audioPath);
  if (!rel) return null;
  const root = userRoot(userId);
  const abs = path.join(root, rel);
  return abs.startsWith(root + path.sep) ? abs : null;
}

/** Stream a file with Range support (audio scrubbing). */
function sendAudio(res, abs) {
  if (!abs || !fs.existsSync(abs)) return res.status(404).json({ ok: false, error: 'That recording isn’t here' });
  const type = AUDIO_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  res.sendFile(abs, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' }, dotfiles: 'deny' });
}

const LIST_COLS = 'id, kind, title, duration_s, source_url, created_at, audio_status, approved, rejected_at, rejected_reason, last_played_at';

/** Items someone can listen to now. */
async function playable(pool, userId, kind) {
  const params = [userId];
  let where = `user_id=$1 AND removed_at IS NULL AND approved AND rejected_at IS NULL AND audio_status='ready' AND audio_path IS NOT NULL`;
  if (kind && KIND_RE.test(kind)) { params.push(kind); where += ` AND kind=$2`; }
  const { rows } = await pool.query(`SELECT ${LIST_COLS} FROM library_item WHERE ${where} ORDER BY created_at DESC LIMIT 100`, params);
  return rows;
}

/** Everything (for whoever approves). status: pending | approved | rejected | all */
async function forReview(pool, userId, status = 'all') {
  let where = 'user_id=$1 AND removed_at IS NULL';
  if (status === 'pending') where += ' AND NOT approved AND rejected_at IS NULL';
  else if (status === 'approved') where += ' AND approved';
  else if (status === 'rejected') where += ' AND rejected_at IS NOT NULL';
  const { rows } = await pool.query(`SELECT ${LIST_COLS}, generated_by, left(transcript, 600) AS preview FROM library_item WHERE ${where} ORDER BY created_at DESC LIMIT 100`, [userId]);
  return rows;
}

/** Create an item (used by the story worker hook and automations). */
async function createItem(pool, userId, f) {
  const status = f.audio_status || (f.audio_path ? 'ready' : 'pending');
  const { rows: [item] } = await pool.query(
    `INSERT INTO library_item(user_id, kind, title, transcript, audio_path, duration_s, generated_by, source_url, source_picks,
                              audio_status, approved, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11, CASE WHEN $11 THEN NOW() END)
     RETURNING id, kind, title, audio_path, audio_status, created_at`,
    [userId, f.kind, String(f.title).slice(0, 300), f.transcript || null, f.audio_path || null, f.duration_s || null,
      f.generated_by || null, f.source_url || null, f.source_picks ? JSON.stringify(f.source_picks) : null, status, !!f.approved]);
  return item;
}

async function setApproval(pool, userId, id, approve, by, reason) {
  if (!UUID_RE.test(id)) return null;
  const { rows: [r] } = approve
    ? await pool.query(`UPDATE library_item SET approved=TRUE, approved_at=NOW(), approved_by=$3, rejected_at=NULL, rejected_reason=NULL
                         WHERE id=$1 AND user_id=$2 AND removed_at IS NULL RETURNING id, kind, title, approved`, [id, userId, by || null])
    : await pool.query(`UPDATE library_item SET rejected_at=NOW(), rejected_reason=$3, approved=FALSE
                         WHERE id=$1 AND user_id=$2 AND removed_at IS NULL RETURNING id, kind, title, audio_path, rejected_at`, [id, userId, String(reason || 'unspecified').slice(0, 300)]);
  return r || null;
}

async function ownItem(pool, userId, id) {
  if (!UUID_RE.test(id)) return null;
  const { rows: [r] } = await pool.query('SELECT * FROM library_item WHERE id=$1 AND user_id=$2 AND removed_at IS NULL', [id, userId]);
  return r || null;
}

module.exports = {
  LIB_ROOT, relOf, fileFor, userRoot, sendAudio, playable, forReview, createItem, setApproval, ownItem, KIND_RE, UUID_RE,

  routes(r, { pool, sprig, parentOnly }) {
    // What the child can listen to.
    r.get('/library', async (req, res) => {
      res.json({ ok: true, items: await playable(pool, req.kid.id, req.query.kind) });
    });
    // Parent: everything, to approve or reject.
    r.get('/library/review', parentOnly, async (req, res) => {
      const status = ['pending', 'approved', 'rejected', 'all'].includes(req.query.status) ? req.query.status : 'all';
      res.json({ ok: true, items: await forReview(pool, req.kid.id, status) });
    });
    r.get('/library/:id/audio', async (req, res) => {
      const it = await ownItem(pool, req.kid.id, req.params.id);
      // A child only hears approved items; a parent can preview anything to decide.
      if (!it || (!req.asParent && (!it.approved || it.rejected_at))) return res.status(404).json({ ok: false, error: 'Not found' });
      sendAudio(res, fileFor(req.kid.id, it.audio_path));
    });
    r.post('/library/:id/played', async (req, res) => {
      const it = await ownItem(pool, req.kid.id, req.params.id);
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      if (req.asParent) return res.json({ ok: true });
      await pool.query('UPDATE library_item SET last_played_at=NOW() WHERE id=$1', [it.id]);
      res.json({ ok: true, sprig: await sprig.reward(req.kid.id, 'story_listened', it.id) });
    });
    r.post('/library/:id/approve', parentOnly, async (req, res) => {
      const it = await setApproval(pool, req.kid.id, req.params.id, true, req.uid);
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, item: it });
    });
    r.post('/library/:id/reject', parentOnly, async (req, res) => {
      const it = await setApproval(pool, req.kid.id, req.params.id, false, req.uid, (req.body || {}).reason || 'parent');
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, item: it });
    });
  },

  // An adult's own library (audio etc.).
  family(r, { pool }) {
    r.get('/library', async (req, res) => {
      const [items, pending] = await Promise.all([playable(pool, req.uid, req.query.kind), forReview(pool, req.uid, 'pending')]);
      res.json({ ok: true, items, pending });
    });
    r.get('/library/summary', async (req, res) => {
      const { rows: [c] } = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE approved AND rejected_at IS NULL AND audio_status='ready')::int AS ready,
                COUNT(*) FILTER (WHERE NOT approved AND rejected_at IS NULL)::int AS pending
           FROM library_item WHERE user_id=$1 AND removed_at IS NULL`, [req.uid]);
      res.json({ ok: true, ...c });
    });
    r.get('/library/:id/audio', async (req, res) => {
      const it = await ownItem(pool, req.uid, req.params.id);
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      sendAudio(res, fileFor(req.uid, it.audio_path));
    });
    r.post('/library/:id/played', async (req, res) => {
      const it = await ownItem(pool, req.uid, req.params.id);
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      await pool.query('UPDATE library_item SET last_played_at=NOW() WHERE id=$1', [it.id]);
      res.json({ ok: true });
    });
    r.post('/library/:id/approve', async (req, res) => {
      const it = await setApproval(pool, req.uid, req.params.id, true, req.uid);
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, item: it });
    });
    r.post('/library/:id/reject', async (req, res) => {
      const it = await setApproval(pool, req.uid, req.params.id, false, req.uid, (req.body || {}).reason || 'not for me');
      if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, item: it });
    });
  },

  // Automations: the same paths and JSON as the old content-admin API, scoped to the hook's person.
  hooks(r, { pool }) {
    // POST { kind, title, transcript, audio_path?, duration_s?, generated_by, source_url?, source_picks?, audio_status? }
    r.post('/api/admin/audio', async (req, res) => {
      const b = req.body || {};
      if (!b.kind || !b.title) return res.status(400).json({ ok: false, error: 'kind_and_title_required' });
      if (!KIND_RE.test(String(b.kind))) return res.status(400).json({ ok: false, error: 'bad_kind' });
      if (b.audio_path && !relOf(b.audio_path)) return res.status(400).json({ ok: false, error: 'bad_audio_path' });
      const item = await createItem(pool, req.hookUser.id, { ...b, approved: false });
      res.json({ ok: true, item });
    });
    // PATCH { audio_path, duration_s, audio_status }
    r.patch('/api/admin/audio/:id', async (req, res) => {
      if (!UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { audio_path, duration_s, audio_status } = req.body || {};
      if (audio_path && !relOf(audio_path)) return res.status(400).json({ ok: false, error: 'bad_audio_path' });
      const { rows } = await pool.query(
        `UPDATE library_item SET audio_path=COALESCE($3, audio_path), duration_s=COALESCE($4, duration_s), audio_status=COALESCE($5, audio_status)
          WHERE id=$1 AND user_id=$2 AND removed_at IS NULL RETURNING id, audio_status, audio_path`,
        [req.params.id, req.hookUser.id, audio_path || null, duration_s || null, audio_status || null]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, item: rows[0] });
    });
    r.post('/api/admin/audio/:id/approve', async (req, res) => {
      const it = await setApproval(pool, req.hookUser.id, req.params.id, true, null);
      if (!it) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, item: it });
    });
    r.post('/api/admin/audio/:id/reject', async (req, res) => {
      const it = await setApproval(pool, req.hookUser.id, req.params.id, false, null, (req.body || {}).reason);
      if (!it) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, item: it });
    });
    // GET ?status=pending|approved|rejected|all
    r.get('/api/admin/audio', async (req, res) => {
      const status = req.query.status || 'all';
      let where = 'user_id=$1 AND removed_at IS NULL';
      if (status === 'pending') where += ' AND approved = FALSE AND rejected_at IS NULL';
      else if (status === 'approved') where += ' AND approved = TRUE';
      else if (status === 'rejected') where += ' AND rejected_at IS NOT NULL';
      const { rows } = await pool.query(
        `SELECT id, kind, title, audio_path, audio_status, approved, approved_at, rejected_at, rejected_reason, created_at
           FROM library_item WHERE ${where} ORDER BY created_at DESC LIMIT 50`, [req.hookUser.id]);
      res.json({ ok: true, items: rows });
    });
  },
};
