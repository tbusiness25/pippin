/*
 * Daily link digest: a few hand-picked articles a day, chosen by an external workflow (e.g. n8n) and
 * written here per person through the hooks API. Shown on Explore → Digest for people who have any.
 *
 * Hooks (X-Admin-Token: HOOKS_TOKEN, server-to-server only), per person by slug:
 *   POST /hooks/<slug>/api/admin/digest-seen  {url}                        → {ok, seen}
 *   POST /hooks/<slug>/api/admin/digest-mark  {urls:[…]}                   → {ok, marked}
 *   POST /hooks/<slug>/api/admin/digest       {digest_date, picks, rendered_telegram} → {ok, digest:{id, digest_date}}
 *   GET  /hooks/<slug>/api/admin/digests?since=YYYY-MM-DD | ?days=7        → {ok, digests:[{digest_date, picks}]}
 * A pick is {title, url, source?, summary?, why?, read_minutes?}.
 */
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const adultHook = (req, res, next) => (req.hookUser.role === 'adult' ? next() : res.status(404).json({ ok: false, error: 'unknown person' }));
const flag = (pool, uid, on) => pool.query(`UPDATE users SET settings = settings || jsonb_build_object('fam_digest', $2::boolean) WHERE id=$1`, [uid, on]);

module.exports = {
  family(r, { pool }) {
    r.get('/digest/recent', a(async (req, res) => {
      const days = Math.min(Math.max(parseInt(req.query.days || '30', 10) || 30, 1), 365);
      const { rows } = await pool.query(`SELECT id, digest_date, picks, created_at FROM family_digests
        WHERE user_id=$1 AND digest_date >= CURRENT_DATE - $2::int ORDER BY digest_date DESC LIMIT 60`, [req.uid, days]);
      res.json({ ok: true, digests: rows });
    }));
  },

  hooks(r, { pool }) {
    r.post('/api/admin/digest-seen', adultHook, a(async (req, res) => {
      const url = String((req.body || {}).url || '').slice(0, 2048);
      if (!url) return res.status(400).json({ ok: false, error: 'url_required' });
      const { rows } = await pool.query('SELECT 1 FROM family_digest_seen WHERE user_id=$1 AND url=$2', [req.hookUser.id, url]);
      res.json({ ok: true, seen: rows.length > 0 });
    }));

    r.post('/api/admin/digest-mark', adultHook, a(async (req, res) => {
      const urls = Array.isArray((req.body || {}).urls) ? req.body.urls : [];
      for (const u of urls) {
        if (typeof u === 'string' && u) {
          await pool.query('INSERT INTO family_digest_seen(user_id, url) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.hookUser.id, u.slice(0, 2048)]);
        }
      }
      res.json({ ok: true, marked: urls.length });
    }));

    r.post('/api/admin/digest', adultHook, a(async (req, res) => {
      const { digest_date: day, picks, rendered_telegram: rendered } = req.body || {};
      if (!DATE.test(day || '') || !Array.isArray(picks)) return res.status(400).json({ ok: false, error: 'fields_required' });
      const { rows: [d] } = await pool.query(
        `INSERT INTO family_digests(user_id, digest_date, picks, rendered_telegram) VALUES ($1,$2,$3::jsonb,$4)
         ON CONFLICT (user_id, digest_date) DO UPDATE SET picks=EXCLUDED.picks, rendered_telegram=EXCLUDED.rendered_telegram, created_at=NOW()
         RETURNING id, digest_date`, [req.hookUser.id, day, JSON.stringify(picks.slice(0, 20)), rendered ? String(rendered).slice(0, 20000) : null]);
      await flag(pool, req.hookUser.id, true);
      res.json({ ok: true, digest: d });
    }));

    // For a weekly round-up (e.g. a weekly summary workflow): this person's digests since a date (default 7 days back).
    r.get('/api/admin/digests', adultHook, a(async (req, res) => {
      const days = Math.min(Math.max(parseInt(req.query.days || '7', 10) || 7, 1), 366);
      const since = DATE.test(req.query.since || '') ? req.query.since : null;
      const { rows } = await pool.query(`SELECT digest_date, picks FROM family_digests
        WHERE user_id=$1 AND digest_date >= COALESCE($2::date, CURRENT_DATE - $3::int) ORDER BY digest_date DESC`, [req.hookUser.id, since, days]);
      res.json({ ok: true, digests: rows });
    }));
  },

  start({ pool }) {
    // users.settings.fam_digest = "has any digests" — lets the app decide whether to show the Explore tile.
    pool.query(`UPDATE users u SET settings = u.settings || jsonb_build_object('fam_digest',
        EXISTS (SELECT 1 FROM family_digests d WHERE d.user_id = u.id)) WHERE u.deleted_at IS NULL`)
      .catch((e) => console.warn('[digest] flags', e.message));
  },
};
