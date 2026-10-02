/* Capture inbox, if-then plans and memories-awaiting-approval. */
const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const vault = require('../coach/vault');

const router = express.Router();

// ---------- inbox ----------
router.get('/inbox', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, text, due_on, status, created_at FROM inbox_items WHERE user_id=$1 AND status='open' ORDER BY due_on NULLS LAST, created_at`, [req.uid]);
  res.json({ ok: true, items: rows });
});
router.post('/inbox', async (req, res) => {
  const text = String((req.body || {}).text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ ok: false });
  await pool.query('INSERT INTO inbox_items(user_id, text, due_on) VALUES ($1,$2,$3)', [req.uid, text, /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_on || '') ? req.body.due_on : null]);
  vault.syncPlans(req.uid).catch(() => {});
  res.json({ ok: true });
});
// status: done | dropped | today (turns it into a goal for today)
router.post('/inbox/:id/:action', async (req, res) => {
  const { action } = req.params;
  const { rows } = await pool.query(`SELECT text FROM inbox_items WHERE id=$1 AND user_id=$2 AND status='open'`, [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  if (action === 'today') {
    const user = await game.getUser(req.uid);
    const { rows: g } = await pool.query(`INSERT INTO goals(user_id, title, category, days, once_on, source) VALUES ($1,$2,'general','{}',$3,'manual') RETURNING id`,
      [req.uid, rows[0].text.slice(0, 80), game.localDay(user.tz)]);
    await pool.query(`UPDATE inbox_items SET status='scheduled', goal_id=$2, closed_at=NOW() WHERE id=$1`, [req.params.id, g[0].id]);
  } else if (['done', 'dropped'].includes(action)) {
    await pool.query(`UPDATE inbox_items SET status=$2, closed_at=NOW() WHERE id=$1`, [req.params.id, action]);
  } else return res.status(400).json({ ok: false });
  vault.syncPlans(req.uid).catch(() => {});
  res.json({ ok: true });
});

// ---------- if-then plans ----------
router.get('/commitments', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, what, when_text, due_at, barrier, backup, status, created_at FROM commitments
     WHERE user_id=$1 AND (status='open' OR closed_at > NOW() - interval '2 days') ORDER BY status, due_at NULLS LAST, created_at`, [req.uid]);
  res.json({ ok: true, commitments: rows });
});
router.post('/commitments/:id/:status', async (req, res) => {
  if (!['done', 'missed', 'dropped', 'open'].includes(req.params.status)) return res.status(400).json({ ok: false });
  const { rowCount } = await pool.query(
    `UPDATE commitments SET status=$3, closed_at=CASE WHEN $3='open' THEN NULL ELSE NOW() END WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.uid, req.params.status]);
  let energy = null;
  // Keeping a plan is the core skill — it feeds the sprig like a goal does.
  if (rowCount && req.params.status === 'done') energy = await game.addEnergy(req.uid, game.ENERGY.goal, 'plan kept');
  vault.syncPlans(req.uid).catch(() => {});
  res.json({ ok: true, energy });
});

// ---------- memories (approve before anything is written to Obsidian) ----------
router.get('/memories', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, kind, title, body, status, vault_path, created_at FROM memories WHERE user_id=$1
     ORDER BY (status='proposed') DESC, created_at DESC LIMIT 60`, [req.uid]);
  res.json({ ok: true, memories: rows, vault: vault.enabled() && !!(await game.getUser(req.uid)).is_owner });
});
router.post('/memories/:id/:decision', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM memories WHERE id=$1 AND user_id=$2`, [req.params.id, req.uid]);
  if (!rows.length) return res.status(404).json({ ok: false });
  const m = rows[0];
  if (req.params.decision === 'approve') {
    const user = await game.getUser(req.uid);
    const edited = { ...m, title: (req.body || {}).title || m.title, body: (req.body || {}).body || m.body };
    const path = await vault.writeMemory(req.uid, edited, game.localDay(user.tz));
    await pool.query(`UPDATE memories SET status='approved', title=$2, body=$3, vault_path=$4, decided_at=NOW() WHERE id=$1`,
      [m.id, edited.title, edited.body, path]);
    return res.json({ ok: true, saved: path });
  }
  if (req.params.decision === 'reject') {
    await pool.query(`UPDATE memories SET status='rejected', decided_at=NOW() WHERE id=$1`, [m.id]);
    return res.json({ ok: true });
  }
  res.status(400).json({ ok: false });
});

module.exports = router;
