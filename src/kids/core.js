/*
 * Kids core: the child's home screen data, and the per-child module switches parents control.
 * users.settings.kids = { off: ['games', …], accent: '#ff8838' }  — modules listed in `off` are hidden for that child.
 */
const SWITCHABLE = () => require('./index').installed;
const offFor = (kid) => new Set(((kid.settings || {}).kids || {}).off || []);

module.exports = {
  offFor,
  routes(r, { pool, game, parentOnly }) {
    // Everything the kids' home needs: who, which modules are on, the sprig, and savings jars for the room.
    r.get('/me', async (req, res) => {
      const kid = req.kid;
      const off = offFor(kid);
      const pet = await game.getPet(kid.id);
      let jars = [];
      try {
        const { rows } = await pool.query(
          `SELECT id, title, icon_emoji, target_pence, saved_pence, kind FROM kid_money_goals
            WHERE child_id=$1 AND active ORDER BY sort_order, created_at LIMIT 6`, [kid.id]);
        jars = rows;
      } catch (_) { /* money module not installed */ }
      const { accessNow } = require('./access');
      const access = req.asParent ? { allow: null, until: null } : accessNow(kid);
      res.json({ ok: true, child: { id: kid.id, name: kid.name, accent: ((kid.settings || {}).kids || {}).accent || null },
        modules: SWITCHABLE().filter((m) => !off.has(m) && (!access.allow || access.allow.has(m))),
        access: access.allow ? { limited: true, until: access.until, allow: [...access.allow] } : { limited: false },
        asParent: req.asParent,
        pet: pet && { name: pet.name, colour: pet.colour, acorns: pet.acorns, adventures: pet.adventures, equipped: pet.equipped, home: pet.home }, jars });
    });

    // Parent: switch modules on/off for this child.
    r.post('/settings', parentOnly, async (req, res) => {
      const b = req.body || {};
      const off = Array.isArray(b.off) ? b.off.filter((m) => SWITCHABLE().includes(m)) : [...offFor(req.kid)];
      const accent = /^#[0-9a-f]{3,8}$/i.test(b.accent || '') ? b.accent : ((req.kid.settings || {}).kids || {}).accent || null;
      // Merge: the child's profile (age, about…) lives in the same object and must survive a switch toggle.
      await pool.query(`UPDATE users SET settings = jsonb_set(settings, '{kids}', COALESCE(settings->'kids', '{}'::jsonb) || $2::jsonb) WHERE id=$1`,
        [req.kid.id, JSON.stringify({ off, accent })]);
      res.json({ ok: true, off, accent, all: SWITCHABLE() });
    });
  },
};
