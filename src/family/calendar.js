/*
 * The household calendar: one shared list of dates every adult sees and edits (children don't).
 * Other modules may insert rows too (e.g. a child's request a parent plans → source='wishlist').
 * Times are local 'HH:MM' text; an event without a start time is all-day. Removing is a soft delete.
 */
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLS = `e.id, e.title, e.starts_on, e.ends_on, e.all_day, e.start_time, e.end_time, e.notes, e.source,
  e.created_by, u.name AS created_by_name, e.created_at, e.updated_at`;

const clean = {
  title: (v) => String(v || '').trim().slice(0, 200),
  notes: (v) => String(v || '').trim().slice(0, 1000) || null,
  time: (v) => (TIME.test(v || '') ? v : null),
  date: (v) => (DATE.test(v || '') ? v : null),
};

async function one(pool, id) {
  const { rows: [e] } = await pool.query(`SELECT ${COLS} FROM family_calendar_events e LEFT JOIN users u ON u.id = e.created_by
    WHERE e.id=$1 AND e.deleted_at IS NULL`, [id]);
  return e || null;
}

/** Events overlapping [from, to] (inclusive), for any module that wants them (e.g. the briefing). */
async function between(pool, from, to) {
  const { rows } = await pool.query(`SELECT ${COLS} FROM family_calendar_events e LEFT JOIN users u ON u.id = e.created_by
     WHERE e.deleted_at IS NULL AND e.starts_on <= $2 AND COALESCE(e.ends_on, e.starts_on) >= $1
     ORDER BY e.starts_on, e.start_time NULLS FIRST, e.created_at`, [from, to]);
  return rows;
}

module.exports = {
  between,
  family(r, { pool, util }) {
    // GET /api/family/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD (default: a month back, four months ahead)
    r.get('/calendar/events', a(async (req, res) => {
      const today = util.localDate();
      const from = clean.date(req.query.from) || new Date(Date.parse(today) - 31 * 864e5).toISOString().slice(0, 10);
      const to = clean.date(req.query.to) || new Date(Date.parse(today) + 120 * 864e5).toISOString().slice(0, 10);
      res.json({ ok: true, today, events: await between(pool, from, to) });
    }));

    // POST /api/family/calendar/events {title, starts_on, ends_on?, start_time?, end_time?, notes?}
    r.post('/calendar/events', a(async (req, res) => {
      const b = req.body || {};
      const title = clean.title(b.title);
      const starts = clean.date(b.starts_on || b.event_date);
      if (!title) return res.status(400).json({ ok: false, error: 'What is it? (a title please)' });
      if (!starts) return res.status(400).json({ ok: false, error: 'Which day?' });
      let ends = clean.date(b.ends_on);
      if (ends && ends < starts) ends = null;
      const start = clean.time(b.start_time), end = start ? clean.time(b.end_time) : null;
      const { rows: [row] } = await pool.query(
        `INSERT INTO family_calendar_events(title, starts_on, ends_on, all_day, start_time, end_time, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [title, starts, ends, !start, start, end, clean.notes(b.notes), req.uid]);
      res.json({ ok: true, event: await one(pool, row.id) });
    }));

    // POST /api/family/calendar/events/:id/update — any subset of the fields above.
    r.post('/calendar/events/:id/update', a(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const cur = await one(pool, req.params.id);
      if (!cur) return res.status(404).json({ ok: false, error: 'not_found' });
      const b = req.body || {};
      const next = { ...cur };
      if (b.title !== undefined) { next.title = clean.title(b.title); if (!next.title) return res.status(400).json({ ok: false, error: 'A title please' }); }
      if (b.starts_on !== undefined) { next.starts_on = clean.date(b.starts_on); if (!next.starts_on) return res.status(400).json({ ok: false, error: 'Which day?' }); }
      if (b.ends_on !== undefined) next.ends_on = clean.date(b.ends_on);
      if (b.start_time !== undefined) next.start_time = clean.time(b.start_time);
      if (b.end_time !== undefined) next.end_time = clean.time(b.end_time);
      if (b.notes !== undefined) next.notes = clean.notes(b.notes);
      if (next.ends_on && next.ends_on < next.starts_on) next.ends_on = null;
      if (!next.start_time) next.end_time = null;
      await pool.query(`UPDATE family_calendar_events SET title=$2, starts_on=$3, ends_on=$4, all_day=$5, start_time=$6, end_time=$7,
          notes=$8, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`,
        [cur.id, next.title, next.starts_on, next.ends_on, !next.start_time, next.start_time, next.end_time, next.notes]);
      res.json({ ok: true, event: await one(pool, cur.id) });
    }));

    // POST /api/family/calendar/events/:id/remove — soft delete.
    r.post('/calendar/events/:id/remove', a(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rowCount } = await pool.query(`UPDATE family_calendar_events SET deleted_at=NOW(), updated_at=NOW()
        WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
      if (!rowCount) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true });
    }));
  },
};
