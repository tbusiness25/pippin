/*
 * Kids: chores ("jobs"). Each child has their own list; ticking one off once per (local) day earns its stars
 * (kid_star_ledger, see stars.js) and gives the sprig some energy. Parents add/edit/remove (soft) chores and can
 * reset today's or this week's ticks (soft — stars already earned are kept, as before).
 */
const { addStars, balance, tx, slugify, isUuid } = require('./stars');

// Generic starter list for a child with no chores yet. Small/quick = 1 star, moderate = 2, longer = 3.
const DEFAULT_CHORES = [
  ['get_dressed', 'Get dressed', 'Clothes on, ready for the day.', '👕', 'daily', 1],
  ['brush_teeth_am', 'Brush teeth (morning)', 'Top, bottom, front, back.', '🪥', 'daily', 1],
  ['help_breakfast', 'Help with breakfast', 'Get your bowl, pour cereal, find the spoon.', '🥣', 'daily', 2],
  ['tidy_room', 'Tidy room', 'Things back in boxes, bed pulled up.', '🧸', 'daily', 2],
  ['plate_away', 'Put plate away', 'After a meal, plate and cup to the sink.', '🍽️', 'daily', 1],
  ['homework', 'Homework', 'A bit of reading, writing or maths.', '📚', 'daily', 3],
  ['brush_teeth_pm', 'Brush teeth (night)', 'Top, bottom, front, back. Last thing before bed.', '🌙', 'daily', 1],
];
const FREQS = ['daily', 'weekly', 'matchday', 'adhoc'];

async function seedChores(pool, childId) {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM kid_chores WHERE child_id=$1', [childId]);
  if (n) return;
  for (const [i, [slug, title, desc, emoji, freq, stars]] of DEFAULT_CHORES.entries()) {
    await pool.query(`INSERT INTO kid_chores(child_id, slug, title, description, icon_emoji, frequency, star_value, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (child_id, slug) DO NOTHING`, [childId, slug, title, desc, emoji, freq, stars, (i + 1) * 10]);
  }
}

module.exports = {
  seedChores, DEFAULT_CHORES,

  routes(r, { pool, sprig, util, parentOnly }) {
    const today = (kid) => util.localDate(kid.tz);

    // All active chores + whether each is done today.
    r.get('/chores', async (req, res) => {
      const kid = req.kid, day = today(kid);
      await seedChores(pool, kid.id);
      const { rows } = await pool.query(
        `SELECT c.id, c.slug, c.title, c.description, c.icon_emoji, c.frequency, c.star_value, c.sort_order,
                cc.id AS completion_id, cc.completed_at, cc.stars_awarded
           FROM kid_chores c
           LEFT JOIN kid_chore_completions cc ON cc.chore_id=c.id AND cc.completed_date=$2 AND cc.removed_at IS NULL
          WHERE c.child_id=$1 AND c.active ORDER BY c.sort_order, c.title`, [kid.id, day]);
      res.json({ ok: true, today: day, balance: await balance(pool, kid.id), chores: rows.map((x) => ({
        id: x.id, slug: x.slug, title: x.title, description: x.description, icon_emoji: x.icon_emoji, frequency: x.frequency,
        star_value: x.star_value, completed_today: x.completion_id !== null, completion_id: x.completion_id,
        completed_at: x.completed_at, stars_awarded: x.stars_awarded })) });
    });

    // Tick a chore (idempotent per day).
    r.post('/chores/:id/complete', async (req, res) => {
      const kid = req.kid, day = today(kid);
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      try {
        const out = await tx(pool, async (c) => {
          const { rows: [ch] } = await c.query('SELECT id, slug, title, star_value FROM kid_chores WHERE id=$1 AND child_id=$2 AND active', [req.params.id, kid.id]);
          if (!ch) return { status: 404, body: { ok: false, error: 'not_found' } };
          await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kid-chore:${ch.id}`]);
          const { rows: [ex] } = await c.query(`SELECT id, stars_awarded FROM kid_chore_completions WHERE chore_id=$1 AND completed_date=$2 AND removed_at IS NULL`, [ch.id, day]);
          if (ex) return { status: 200, body: { ok: true, already_completed: true, completion: ex, balance: await balance(c, kid.id) } };
          const stars = Math.max(0, ch.star_value | 0);
          const { rows: [comp] } = await c.query(`INSERT INTO kid_chore_completions(child_id, chore_id, completed_date, stars_awarded)
            VALUES ($1,$2,$3,$4) RETURNING id, completed_at, stars_awarded`, [kid.id, ch.id, day, stars]);
          const bal = await addStars(c, kid.id, { source: 'chore', ref: comp.id, stars, note: ch.slug });
          return { status: 200, body: { ok: true, already_completed: false, completion: comp, balance: bal, stars_awarded: stars }, chore: ch };
        });
        if (out.chore) {
          util.audit(req.uid, 'chore_complete', { child: kid.id, chore_slug: out.chore.slug, stars: out.body.stars_awarded });
          out.body.sprig = await sprig.reward(kid.id, 'chore', out.body.completion.id).catch(() => null);
        }
        res.status(out.status).json(out.body);
      } catch (e) { console.error('[kids/chores/complete]', e.message); res.status(500).json({ ok: false, error: 'internal' }); }
    });

    // ---- Parent ----
    r.get('/chores/manage', parentOnly, async (req, res) => {
      await seedChores(pool, req.kid.id);
      const { rows } = await pool.query(`SELECT id, slug, title, description, icon_emoji, frequency, star_value, active, sort_order
        FROM kid_chores WHERE child_id=$1 ORDER BY active DESC, sort_order, title`, [req.kid.id]);
      res.json({ ok: true, chores: rows });
    });

    // This week (Mon–Sun, child's local time): which chores were done which day.
    r.get('/chores/week', parentOnly, async (req, res) => {
      const kid = req.kid, day = today(kid);
      const { rows } = await pool.query(`
        WITH days AS (SELECT generate_series(date_trunc('week', $2::date)::date, date_trunc('week', $2::date)::date + 6, '1 day')::date AS d)
        SELECT c.id, c.slug, c.title, c.icon_emoji, c.frequency, c.star_value,
               ARRAY(SELECT json_build_object('d', to_char(days.d,'YYYY-MM-DD'), 'done', EXISTS(
                       SELECT 1 FROM kid_chore_completions cc WHERE cc.chore_id=c.id AND cc.completed_date=days.d AND cc.removed_at IS NULL))
                       FROM days ORDER BY days.d) AS days
          FROM kid_chores c WHERE c.child_id=$1 AND c.active ORDER BY c.sort_order, c.title`, [kid.id, day]);
      res.json({ ok: true, today: day, chores_week: rows });
    });

    r.post('/chores', parentOnly, async (req, res) => {
      const b = req.body || {};
      const title = String(b.title || '').trim().slice(0, 80);
      if (!title) return res.status(400).json({ ok: false, error: 'title_required' });
      const stars = Math.max(0, Math.min(50, parseInt(b.star_value, 10) || 1));
      const freq = FREQS.includes(b.frequency) ? b.frequency : 'daily';
      const { rows: [ch] } = await pool.query(`INSERT INTO kid_chores(child_id, slug, title, description, icon_emoji, frequency, star_value, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE((SELECT MAX(sort_order)+10 FROM kid_chores WHERE child_id=$1),10))
        RETURNING id, title, star_value, active`, [req.kid.id, slugify(title), title, b.description ? String(b.description).slice(0, 200) : null,
        String(b.icon_emoji || '⭐').slice(0, 8), freq, stars]);
      util.audit(req.uid, 'chore_add', { child: req.kid.id, title });
      res.json({ ok: true, chore: ch });
    });

    r.patch('/chores/:id', parentOnly, async (req, res) => {
      const b = req.body || {};
      const sets = [], vals = [req.params.id, req.kid.id];
      const set = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
      if (typeof b.title === 'string' && b.title.trim()) set('title', b.title.trim().slice(0, 80));
      if (b.star_value != null) set('star_value', Math.max(0, Math.min(50, parseInt(b.star_value, 10) || 0)));
      if (typeof b.icon_emoji === 'string') set('icon_emoji', b.icon_emoji.slice(0, 8));
      if (typeof b.description === 'string') set('description', b.description.slice(0, 200));
      if (FREQS.includes(b.frequency)) set('frequency', b.frequency);
      if (typeof b.active === 'boolean') set('active', b.active);
      if (!sets.length || !isUuid(req.params.id)) return res.status(400).json({ ok: false, error: 'no_fields' });
      const { rows } = await pool.query(`UPDATE kid_chores SET ${sets.join(', ')} WHERE id=$1 AND child_id=$2 RETURNING id, title, star_value, active`, vals);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, chore: rows[0] });
    });

    r.delete('/chores/:id', parentOnly, async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query('UPDATE kid_chores SET active=FALSE WHERE id=$1 AND child_id=$2 RETURNING id', [req.params.id, req.kid.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, removed: rows[0].id });
    });

    // Clear today's (or this week's) ticks so they can be done again. Soft: stars already earned stay.
    r.post('/chores/reset', parentOnly, async (req, res) => {
      const scope = (req.body || {}).scope === 'week' ? 'week' : 'today';
      const day = today(req.kid);
      const where = scope === 'week' ? `completed_date >= date_trunc('week', $2::date)::date` : 'completed_date = $2::date';
      const r2 = await pool.query(`UPDATE kid_chore_completions SET removed_at=NOW() WHERE child_id=$1 AND removed_at IS NULL AND ${where}`, [req.kid.id, day]);
      util.audit(req.uid, 'chores_reset', { child: req.kid.id, scope, cleared: r2.rowCount });
      res.json({ ok: true, scope, cleared: r2.rowCount });
    });
  },
};
