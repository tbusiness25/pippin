/*
 * 🎧 My Yoto — a child's Yoto library and player, managed from their own app.
 *   library: their cards (list, rename; parents can delete)  ·  make a card: recordings or files → one card,
 *   one chapter per recording  ·  players: which Yoto players are on the account and whether they're online.
 * The Yoto connection belongs to the household (src/yoto/api.js); a parent connects it from the Family section.
 * Playing a card still happens on the Yoto player — the API doesn’t offer playback control.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { pool } = require('../db');
const util = require('./util');
const Y = require('../yoto/api');

const MAX_AUDIO = 80 * 1024 * 1024;
const ok = (res, body) => res.json({ ok: true, ...body });
const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: e.message });

module.exports = {
  routes(r, { pool, parentOnly }) {
    r.get('/yoto/status', async (req, res) => {
      const s = await Y.status();
      ok(res, { ...s, isParent: !!req.asParent || req.role === 'adult' });
    });

    r.get('/yoto/cards', async (req, res) => {
      try {
        const list = await Y.cards();
        ok(res, { cards: list.map((c) => ({ id: c.cardId || c.id, title: c.title || 'Untitled', cover: (c.metadata && c.metadata.cover && c.metadata.cover.imageL) || null,
          tracks: (c.content && c.content.chapters ? c.content.chapters.length : null), updated: c.updatedAt || null })) });
      } catch (e) { fail(res, e); }
    });

    r.get('/yoto/devices', async (req, res) => {
      try {
        const list = await Y.devices();
        ok(res, { devices: list.map((d) => ({ id: d.deviceId, name: d.name || 'Yoto player', online: !!d.online, family: d.familyName || null,
          model: d.deviceType || null })) });
      } catch (e) { fail(res, e); }
    });

    // Upload one recording or file. The job converts it and sends it to Yoto in the background.
    r.post('/yoto/tracks', express.raw({ type: () => true, limit: MAX_AUDIO }), async (req, res) => {
      if (!Y.configured()) return res.status(503).json({ ok: false, error: 'Yoto isn’t set up on this server yet' });
      if (!req.body || !req.body.length) return res.status(400).json({ ok: false, error: 'No audio received' });
      const title = String(req.query.title || 'Track').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Track';
      const ext = (String(req.headers['content-type'] || '').split('/')[1] || 'webm').split(';')[0].replace(/[^a-z0-9]/gi, '') || 'webm';
      const { rows: [j] } = await pool.query(`INSERT INTO yoto_jobs(child_id, title) VALUES ($1,$2) RETURNING id`, [req.kid.id, title]);
      const dir = util.ensureDir(util.childDir(req.kid, 'yoto'));
      const src = path.join(dir, `${j.id}.${ext}`);
      fs.writeFileSync(src, req.body);
      Y.makeTrack(j.id, src).finally(() => fs.rm(src, { force: true }, () => {}));
      ok(res, { job: j.id });
    });

    r.get('/yoto/jobs', async (req, res) => {
      const { rows } = await pool.query(`SELECT id, title, status, error, card_id, created_at FROM yoto_jobs WHERE child_id=$1 AND status <> 'used'
        AND created_at > NOW() - interval '2 days' ORDER BY created_at DESC LIMIT 30`, [req.kid.id]);
      ok(res, { jobs: rows });
    });

    // Turn ready recordings into one card, in the order given.
    r.post('/yoto/cards', async (req, res) => {
      try {
        const b = req.body || {};
        const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!title) return res.status(400).json({ ok: false, error: 'Give the card a name' });
        const ids = (Array.isArray(b.job_ids) ? b.job_ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
        if (!ids.length) return res.status(400).json({ ok: false, error: 'Record or add something first' });
        const { rows } = await pool.query(`SELECT id, sha, info, status FROM yoto_jobs WHERE child_id=$1 AND id = ANY($2)`, [req.kid.id, ids]);
        const byId = new Map(rows.map((x) => [x.id, x]));
        const tracks = ids.map((id) => byId.get(id)).filter((x) => x && x.status === 'ready').map((x) => ({ sha: x.sha, info: x.info || {}, title: '' }));
        if (!tracks.length) return res.status(400).json({ ok: false, error: 'Those are still being prepared — give it a moment' });
        tracks.forEach((t, i) => { t.title = tracks.length === 1 ? title : `${title} — part ${i + 1}`; });
        const out = await Y.saveCard(Y.buildCard(title, tracks));
        const cardId = out.cardId || (out.card && out.card.cardId) || null;
        await pool.query(`UPDATE yoto_jobs SET status='used', card_id=$2 WHERE id = ANY($1)`, [ids, cardId]);
        ok(res, { card_id: cardId });
      } catch (e) { fail(res, e); }
    });

    r.post('/yoto/cards/:id/rename', async (req, res) => {
      try {
        const title = String((req.body || {}).title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!title) return res.status(400).json({ ok: false, error: 'Give it a name' });
        const c = await Y.card(req.params.id);
        await Y.saveCard({ cardId: req.params.id, title, content: c.content, metadata: c.metadata });
        ok(res, {});
      } catch (e) { fail(res, e); }
    });

    // Deleting a card is a grown-up job.
    r.delete('/yoto/cards/:id', parentOnly, async (req, res) => {
      try { await Y.deleteCard(req.params.id); ok(res, {}); } catch (e) { fail(res, e); }
    });
  },
};
