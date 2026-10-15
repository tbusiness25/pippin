/*
 * Family: the household's children, as parents see them. Adding a child creates a child account
 * (role=child) with its own PIN; the child signs in on their own device and hatches their own sprig.
 */
const { hashPin } = require('../auth');

module.exports = {
  family(r, { pool, requireParent }) {
    r.get('/children', requireParent, async (req, res) => {
      const { rows } = await pool.query(`
        SELECT u.id, u.name, u.slug, u.settings, p.name AS pet_name, p.colour, p.adventures, p.acorns, p.equipped
          FROM users u LEFT JOIN pets p ON p.user_id=u.id AND p.deleted_at IS NULL
         WHERE u.role='child' AND u.deleted_at IS NULL ORDER BY u.created_at`);
      res.json({ ok: true, children: rows.map((c) => ({ ...c, off: ((c.settings || {}).kids || {}).off || [], settings: undefined })) });
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
    // Which adults can see the Family section (owner manages).
    r.get('/people', async (req, res) => {
      const { rows } = await pool.query(`SELECT id, name, role, is_parent, is_owner FROM users WHERE deleted_at IS NULL ORDER BY created_at`);
      res.json({ ok: true, people: rows, me: req.uid });
    });
  },
};
