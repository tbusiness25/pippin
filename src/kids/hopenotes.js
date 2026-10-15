/*
 * 💌 Messages: a child writes or records notes to Mum and Dad, and they answer in the same thread. Text notes
 * (emoji fine) and voice notes (≤ 3 min) go to every grown-up with a gentle push.
 *   GET    /api/kids/notes                 → the thread + the grown-ups
 *   POST   /api/kids/notes/text            { text }
 *   POST   /api/kids/notes/voice?seconds=  raw audio
 *   GET    /api/kids/notes/:id/audio
 *   POST   /api/kids/notes/reply           parent: { text }
 *   POST   /api/kids/notes/read            parent: marks the child's notes as seen
 *   DELETE /api/kids/notes/:id             parent: remove (soft)
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const isId = (s) => /^[0-9a-f-]{36}$/i.test(String(s));

module.exports = {
  routes(r, { pool, parentOnly, util }) {
    const name = (req) => String(req.kid.name).trim();
    const MAX_NOTE = 1000;
    const grownUps = async () => (await pool.query(`SELECT id, name FROM users WHERE role='adult' AND is_parent AND deleted_at IS NULL ORDER BY created_at`)).rows;
    const push = (uid, text, ref, title, kid) => require('../push').notify(uid, 'kid-note', text, { ref, title, url: '/#family' }).catch(() => {});

    r.get('/notes', async (req, res) => {
      const { rows } = await pool.query(`SELECT m.id, m.sender, m.kind, m.body, m.seconds, m.created_at, m.read_at, m.audio_file IS NOT NULL AS has_audio,
          (SELECT name FROM users u WHERE u.id = m.parent_id) AS parent_name
        FROM kid_messages m WHERE m.child_id=$1 AND m.removed_at IS NULL ORDER BY m.created_at DESC LIMIT 200`, [req.kid.id]);
      res.json({ ok: true, messages: rows.reverse(), parents: (await grownUps()).map((p) => ({ id: p.id, name: String(p.name).trim() })) });
    });

    r.post('/notes/text', async (req, res) => {
      if (req.asParent) return res.status(403).json({ ok: false, error: 'Only the child writes these' });
      const text = String((req.body || {}).text || '').trim().slice(0, MAX_NOTE);
      if (!text) return res.status(400).json({ ok: false, error: 'Write something first' });
      const { rows: [m] } = await pool.query(`INSERT INTO kid_messages(child_id, sender, kind, body) VALUES ($1,'child','text',$2) RETURNING id, created_at`, [req.kid.id, text]);
      for (const p of await grownUps()) push(p.id, `${name(req)}: ${text.slice(0, 80)}`, `note:${m.id}:${p.id}`, `💬 Note from ${name(req)}`, req.kid);
      res.json({ ok: true, id: m.id });
    });

    r.post('/notes/voice', express.raw({ type: () => true, limit: '15mb' }), async (req, res) => {
      if (req.asParent) return res.status(403).json({ ok: false, error: 'Only the child records these' });
      if (!req.body || req.body.length < 2000) return res.status(400).json({ ok: false, error: 'That was too short — try again' });
      const ext = ((String(req.headers['content-type'] || 'audio/webm').split('/')[1] || 'webm').split(';')[0].replace(/[^a-z0-9]/gi, '')) || 'webm';
      const seconds = Math.min(180, parseInt(req.query.seconds, 10) || 0) || null;
      const { rows: [m] } = await pool.query(`INSERT INTO kid_messages(child_id, sender, kind, seconds) VALUES ($1,'child','voice',$2) RETURNING id`, [req.kid.id, seconds]);
      const dir = util.ensureDir(util.childDir(req.kid, 'notes'));
      const file = path.join(dir, `${m.id}.${ext}`);
      fs.writeFileSync(file, req.body);
      await pool.query('UPDATE kid_messages SET audio_file=$2 WHERE id=$1', [m.id, file]);
      for (const p of await grownUps()) push(p.id, `${name(req)} sent you a voice note 🎙`, `note:${m.id}:${p.id}`, `🎙 Voice note from ${name(req)}`, req.kid);
      res.json({ ok: true, id: m.id });
    });

    r.get('/notes/:id/audio', async (req, res) => {
      if (!isId(req.params.id)) return res.status(404).end();
      const { rows: [m] } = await pool.query('SELECT audio_file FROM kid_messages WHERE id=$1 AND child_id=$2 AND removed_at IS NULL', [req.params.id, req.kid.id]);
      if (!m || !m.audio_file || !fs.existsSync(m.audio_file)) return res.status(404).end();
      res.sendFile(m.audio_file);
    });

    r.post('/notes/reply', parentOnly, async (req, res) => {
      const text = String((req.body || {}).text || '').trim().slice(0, MAX_NOTE);
      if (!text) return res.status(400).json({ ok: false, error: 'Write something first' });
      const { rows: [m] } = await pool.query(`INSERT INTO kid_messages(child_id, sender, parent_id, kind, body) VALUES ($1,'parent',$2,'text',$3) RETURNING id`, [req.kid.id, req.uid, text]);
      const { rows: [who] } = await pool.query('SELECT name FROM users WHERE id=$1', [req.uid]);
      push(req.kid.id, `${String((who || {}).name || 'Mum or Dad').trim()} wrote back 💬`, `reply:${m.id}`, 'A reply for you', req.kid);
      res.json({ ok: true, id: m.id });
    });

    r.post('/notes/read', parentOnly, async (req, res) => {
      await pool.query(`UPDATE kid_messages SET read_at=NOW() WHERE child_id=$1 AND sender='child' AND read_at IS NULL`, [req.kid.id]);
      res.json({ ok: true });
    });

    r.delete('/notes/:id', parentOnly, async (req, res) => {
      if (!isId(req.params.id)) return res.status(400).json({ ok: false, error: 'Unknown note' });
      await pool.query('UPDATE kid_messages SET removed_at=NOW() WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id]);
      res.json({ ok: true });
    });

    // The Hope box is a separate, optional module that this build does not include.
    r.all('/hope-notes', (req, res) => res.status(404).json({ ok: false, error: 'Not set up here' }));
  },
};
