/*
 * Family: the household's children, as parents see them. Adding a child creates a child account
 * (role=child) with its own PIN; the child signs in on their own device and hatches their own sprig.
 *
 * Parents (adults with is_parent) hold each child's data rights. Every route here is parent-only:
 *   GET    /children/:id/export          everything held about the child, as one JSON file (secrets left out)
 *   GET    /children/:id/export/files    a .tar of their files: ?root=library for their audio library, else their kids' folder
 *   DELETE /children/:id                 remove them: body { confirm: '<their exact name>' }. They can't sign in any more;
 *                                        the data is purged for good after CHILD_PURGE_DAYS (see ./childData.js)
 * Adults are never touched by any of these.
 */
const { hashPin } = require('../auth');
const childData = require('./childData');
const util = require('../kids/util');

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  family(r, { pool, requireParent }) {
    // A child by id, removed ones included (a parent can still take their data out during the purge window).
    async function childOr404(req, res) {
      if (!childData.UUID_RE.test(req.params.id)) { res.status(404).json({ ok: false, error: 'No such child' }); return null; }
      const { rows: [kid] } = await pool.query(`SELECT id, name, deleted_at, settings FROM users WHERE id=$1 AND role='child'`, [req.params.id]);
      if (!kid) { res.status(404).json({ ok: false, error: 'No such child' }); return null; }
      return kid;
    }

    r.get('/children', requireParent, async (req, res) => {
      const { rows } = await pool.query(`
        SELECT u.id, u.name, u.slug, u.settings, p.name AS pet_name, p.colour, p.adventures, p.acorns, p.equipped
          FROM users u LEFT JOIN pets p ON p.user_id=u.id AND p.deleted_at IS NULL
         WHERE u.role='child' AND u.deleted_at IS NULL ORDER BY u.created_at`);
      const purge_days = childData.purgeDays();
      res.json({ ok: true, children: rows.map((c) => ({ ...c, off: ((c.settings || {}).kids || {}).off || [], settings: undefined, purge_days })) });
    });
    r.post('/children', requireParent, async (req, res) => {
      const { name, pin } = req.body || {};
      if (!name || !/^\d{4,8}$/.test(pin || '')) return res.status(400).json({ ok: false, error: 'A name and a 4–8 digit PIN please' });
      const { rows: [me] } = await pool.query('SELECT tz FROM users WHERE id=$1', [req.uid]);
      const { rows } = await pool.query(
        `INSERT INTO users(name, pin_hash, tz, settings, role) VALUES ($1,$2,$3,$4,'child') RETURNING id`,
        [String(name).slice(0, 40), await hashPin(pin), me.tz, { streaks_enabled: false }]);
      res.json({ ok: true, id: rows[0].id });
    });

    r.get('/children/:id/export', requireParent, async (req, res) => {
      try {
        const kid = await childOr404(req, res);
        if (!kid) return;
        const doc = await childData.exportChild(kid);
        res.attachment(`pippin-child-${kid.id}-export.json`);
        res.json(doc);
      } catch (e) { console.error('[child-export] failed:', e.message); res.status(500).json({ ok: false, error: 'Could not build the export' }); }
    });

    r.get('/children/:id/export/files', requireParent, async (req, res) => {
      const kid = await childOr404(req, res);
      if (!kid) return;
      childData.streamTar(res, { root: req.query.root === 'library' ? 'library' : 'kids', id: kid.id });
    });

    r.delete('/children/:id', requireParent, async (req, res) => {
      try {
        const kid = await childOr404(req, res);
        if (!kid) return;
        if (kid.deleted_at) return res.status(404).json({ ok: false, error: 'That child has already been removed' });
        const confirm = typeof req.body?.confirm === 'string' ? req.body.confirm.trim() : '';
        if (!confirm || confirm !== String(kid.name).trim()) {
          return res.status(400).json({ ok: false, error: 'Type the child’s name exactly to confirm' });
        }
        const { rows: [row] } = await pool.query(
          `UPDATE users
              SET deleted_at = NOW(),
                  settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{kids}',
                    COALESCE(settings->'kids', '{}'::jsonb) || jsonb_build_object('removed_at', NOW()))
            WHERE id=$1 AND role='child' AND deleted_at IS NULL
          RETURNING deleted_at`, [kid.id]);
        if (!row) return res.status(409).json({ ok: false, error: 'That child has already been removed' });
        // Their devices get no more notifications, even before the purge.
        await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1', [kid.id]);
        await util.audit(req.uid, 'child_removed', { child: kid.id });
        const purge_days = childData.purgeDays();
        res.json({ ok: true, purge_days, purge_after: new Date(row.deleted_at.getTime() + purge_days * DAY_MS).toISOString() });
      } catch (e) { console.error('[child-remove] failed:', e.message); res.status(500).json({ ok: false, error: 'Could not remove them' }); }
    });

    // Which adults can see the Family section (owner manages).
    r.get('/people', async (req, res) => {
      const { rows } = await pool.query(`SELECT id, name, role, is_parent, is_owner FROM users WHERE deleted_at IS NULL ORDER BY created_at`);
      res.json({ ok: true, people: rows, me: req.uid });
    });
  },

  // Background: the daily purge of removed children (CHILD_PURGE_DAYS, CHILD_PURGE_DRY_RUN).
  start() { childData.startPurge(); },
};
