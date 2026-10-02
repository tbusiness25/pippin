/* General AI chat: conversations list + messages. Separate from the private coach. */
const express = require('express');
const { pool } = require('../db');
const chat = require('../coach/chat');
const { decrypt } = require('../coach/crypto');

const router = express.Router();

router.get('/threads', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, title, updated_at FROM chat_threads WHERE user_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`, [req.uid]);
  res.json({ ok: true, threads: rows, web: chat.WEB });
});
router.post('/threads', async (req, res) => {
  const { rows } = await pool.query(`INSERT INTO chat_threads(user_id) VALUES ($1) RETURNING id, title`, [req.uid]);
  res.json({ ok: true, thread: rows[0] });
});
router.get('/threads/:id', async (req, res) => {
  const t = await chat.ownThread(req.uid, req.params.id);
  if (!t) return res.status(404).json({ ok: false });
  const { rows } = await pool.query(`SELECT role, body_enc, created_at FROM coach_messages WHERE thread_id=$1 ORDER BY id`, [t.id]);
  res.json({ ok: true, thread: { id: t.id, title: t.title }, web: chat.WEB,
    messages: rows.map((r) => { try { return { role: r.role, content: decrypt(r.body_enc), created_at: r.created_at }; } catch { return null; } }).filter(Boolean) });
});
router.post('/threads/:id/message', async (req, res) => {
  const text = String((req.body || {}).text || '').trim().slice(0, 6000);
  if (!text) return res.status(400).json({ ok: false });
  try { res.json({ ok: true, ...(await chat.turn(req.uid, req.params.id, text)) }); }
  catch (e) { console.error('[chat]', e.message); res.status(502).json({ ok: false, error: 'No answer this time — the model may be busy. Try again.' }); }
});
router.post('/threads/:id/rename', async (req, res) => {
  await pool.query('UPDATE chat_threads SET title=$3 WHERE id=$1 AND user_id=$2', [req.params.id, req.uid, String((req.body || {}).title || 'Chat').slice(0, 60)]);
  res.json({ ok: true });
});
router.delete('/threads/:id', async (req, res) => {
  await pool.query('UPDATE chat_threads SET deleted_at=NOW() WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  await pool.query('DELETE FROM coach_messages WHERE thread_id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

module.exports = router;
