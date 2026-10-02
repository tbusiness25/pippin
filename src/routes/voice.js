/* Voice notes: list, transcript, audio, star, re-categorise. */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { decrypt } = require('../coach/crypto');
const ingest = require('../voice/ingest');

const router = express.Router();
const CATS = ['reminder', 'work', 'memory', 'journal', 'kids', 'other'];

router.get('/', async (req, res) => {
  const cat = CATS.includes(req.query.category) ? req.query.category : null;
  const { rows } = await pool.query(
    `SELECT id, recorded_at, category, title, summary, actions, starred, (audio_file IS NOT NULL OR vault_audio IS NOT NULL) has_audio, audio_file IS NOT NULL kept
     FROM voice_notes WHERE user_id=$1 AND deleted_at IS NULL ${cat ? 'AND category=$2' : ''} ${req.query.starred ? 'AND starred' : ''}
     ORDER BY recorded_at DESC NULLS LAST LIMIT 300`, cat ? [req.uid, cat] : [req.uid]);
  const { rows: counts } = await pool.query(`SELECT category, COUNT(*)::int n FROM voice_notes WHERE user_id=$1 AND deleted_at IS NULL GROUP BY category`, [req.uid]);
  res.json({ ok: true, notes: rows, counts: Object.fromEntries(counts.map((c) => [c.category, c.n])), watching: !!process.env.VOICE_NOTES_DIR });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM voice_notes WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  const n = rows[0];
  let transcript = '';
  try { transcript = n.transcript_enc ? decrypt(n.transcript_enc) : ''; } catch (_) {}
  res.json({ ok: true, note: { id: n.id, recorded_at: n.recorded_at, category: n.category, title: n.title, summary: n.summary, actions: n.actions, starred: n.starred, transcript, has_audio: !!(n.audio_file || n.vault_audio) } });
});

router.get('/:id/audio', async (req, res) => {
  const { rows } = await pool.query('SELECT audio_file, vault_audio FROM voice_notes WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).end();
  const dir = process.env.VOICE_NOTES_DIR || '';
  const file = rows[0].audio_file && fs.existsSync(rows[0].audio_file) ? rows[0].audio_file
    : rows[0].vault_audio && dir ? path.join(dir, rows[0].vault_audio) : null;
  if (!file || !fs.existsSync(file) || !path.resolve(file).startsWith(path.resolve(file.startsWith(ingest.STORE) ? ingest.STORE : dir))) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.resolve(file));
});

router.post('/:id/star', async (req, res) => {
  await pool.query('UPDATE voice_notes SET starred = NOT starred WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

// Move a note to another category (kids/memory also keep a permanent audio copy).
router.post('/:id/category', async (req, res) => {
  const cat = (req.body || {}).category;
  if (!CATS.includes(cat)) return res.status(400).json({ ok: false });
  const { rows } = await pool.query('SELECT recording_id, vault_audio, audio_file FROM voice_notes WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  let kept = rows[0].audio_file;
  if (!kept && (cat === 'kids' || cat === 'memory') && rows[0].vault_audio && process.env.VOICE_NOTES_DIR) {
    const src = path.join(process.env.VOICE_NOTES_DIR, rows[0].vault_audio);
    if (fs.existsSync(src)) { fs.mkdirSync(ingest.STORE, { recursive: true }); kept = path.join(ingest.STORE, `${rows[0].recording_id.replace(/[^\w-]/g, '_')}${path.extname(src)}`); if (!fs.existsSync(kept)) fs.copyFileSync(src, kept); }
  }
  await pool.query('UPDATE voice_notes SET category=$3, audio_file=$4, starred = starred OR $3 = \'kids\' WHERE id=$1 AND user_id=$2', [req.params.id, req.uid, cat, kept]);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE voice_notes SET deleted_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

router.post('/scan', async (req, res) => { ingest.scan(); res.json({ ok: true }); });

module.exports = router;
