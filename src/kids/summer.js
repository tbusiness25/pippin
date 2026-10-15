/*
 * Kids: the "Summer" wishlist — things the child would love to do. The child adds ideas; a parent decides
 * (pending | planned | done | not_this_time | talk_first). Nothing is auto-granted. "Plan it" with a date also
 * puts it on the family calendar (family_calendar_events, if that module is installed).
 */
const { parentName, isUuid } = require('./stars');

const DECISIONS = ['planned', 'done', 'not_this_time', 'talk_first', 'pending'];
const COLS = `id, title, note, created_at, parent_decision, parent_decision_at, parent_note, parent_user,
  to_char(planned_date,'YYYY-MM-DD') AS planned_date, calendar_event_id`;

async function calendarAvailable(pool) {
  const { rows: [r] } = await pool.query(`SELECT to_regclass('public.family_calendar_events') IS NOT NULL AS ok`);
  return r.ok;
}

/** Create (or move) the calendar event for a planned item. Never fails the decision. */
async function syncCalendar(pool, kid, item, uid) {
  try {
    if (!item.planned_date || !(await calendarAvailable(pool))) return null;
    const title = `${kid.name}: ${item.title}`.slice(0, 200);
    if (item.calendar_event_id) {
      const { rowCount } = await pool.query(`UPDATE family_calendar_events SET starts_on=$2, ends_on=$2, title=$3, updated_at=NOW(), deleted_at=NULL
        WHERE id=$1`, [item.calendar_event_id, item.planned_date, title]);
      if (rowCount) return item.calendar_event_id;
    }
    const { rows: [ev] } = await pool.query(`INSERT INTO family_calendar_events(title, starts_on, ends_on, all_day, notes, created_by, source, external_id)
      VALUES ($1,$2,$2,TRUE,$3,$4,'kids-summer',$5) RETURNING id`, [title, item.planned_date, `From ${kid.name}'s summer list`, uid, item.id]);
    await pool.query('UPDATE kid_wishlist_items SET calendar_event_id=$2 WHERE id=$1', [item.id, ev.id]);
    return ev.id;
  } catch (e) { console.error('[kids/summer/calendar]', e.message); return null; }
}

module.exports = {
  routes(r, { pool, sprig, util, parentOnly }) {
    r.get('/summer', async (req, res) => {
      const { rows } = await pool.query(`SELECT ${COLS} FROM kid_wishlist_items WHERE child_id=$1 AND removed_at IS NULL
        ORDER BY (parent_decision='pending') DESC, created_at DESC`, [req.kid.id]);
      res.json({ ok: true, items: rows, pending: rows.filter((x) => x.parent_decision === 'pending' || x.parent_decision === 'talk_first').length });
    });

    r.post('/summer', async (req, res) => {
      const title = String((req.body || {}).title || '').trim().slice(0, 200);
      const note = String((req.body || {}).note || '').trim().slice(0, 500) || null;
      if (!title) return res.status(400).json({ ok: false, error: 'What would you like to do?' });
      const { rows: [item] } = await pool.query(`INSERT INTO kid_wishlist_items(child_id, title, note) VALUES ($1,$2,$3)
        RETURNING id, title, note, created_at, parent_decision`, [req.kid.id, title, note]);
      const sp = req.asParent ? null : await sprig.reward(req.kid.id, 'wishlist', item.id).catch(() => null);
      res.json({ ok: true, item, sprig: sp });
    });

    // Changed my mind (soft delete). A child can only remove ideas still waiting for a decision.
    r.post('/summer/:id/remove', async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rowCount } = await pool.query(`UPDATE kid_wishlist_items SET removed_at=NOW()
        WHERE id=$1 AND child_id=$2 AND removed_at IS NULL ${req.asParent ? '' : "AND parent_decision='pending'"}`, [req.params.id, req.kid.id]);
      if (!rowCount) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true });
    });

    // Parent decision. { decision, note?, planned_date? 'YYYY-MM-DD' }
    r.post('/summer/:id/decide', parentOnly, async (req, res) => {
      const b = req.body || {};
      if (!DECISIONS.includes(b.decision)) return res.status(400).json({ ok: false, error: 'bad_decision' });
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const planned = b.planned_date ? String(b.planned_date) : null;
      if (planned && !/^\d{4}-\d{2}-\d{2}$/.test(planned)) return res.status(400).json({ ok: false, error: 'Date must look like 2026-08-04' });
      const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 500) : null;
      const who = await parentName(pool, req.uid);
      const { rows: [item] } = await pool.query(`UPDATE kid_wishlist_items SET parent_decision=$3, parent_decision_at=NOW(), parent_note=$4,
          parent_user=$5, decided_by=$6, planned_date=COALESCE($7::date, CASE WHEN $3 IN ('planned','done') THEN planned_date END)
        WHERE id=$1 AND child_id=$2 AND removed_at IS NULL RETURNING ${COLS}`,
      [req.params.id, req.kid.id, b.decision, note, who, req.uid, planned]);
      if (!item) return res.status(404).json({ ok: false, error: 'not_found' });
      let calendar = null;
      if (b.decision === 'planned' && planned) {
        calendar = await syncCalendar(pool, req.kid, item, req.uid);
        if (calendar) item.calendar_event_id = calendar;
      }
      util.audit(req.uid, 'wishlist_decide', { child: req.kid.id, item: item.id, decision: b.decision });
      res.json({ ok: true, item, calendar_event_id: calendar });
    });
  },
};
