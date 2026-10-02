/*
 * Relationship upkeep from METADATA only: who, when, which direction. Message bodies are never
 * imported or stored, and Pippin never infers moods or traits about other people.
 * Sources: WhatsApp history import, Facebook export import, live WhatsApp link (pippin-whatsapp sidecar),
 * and "I was in touch" taps.
 */
const { pool } = require('../db');

const RING_CADENCE = { closest: 7, close: 21, friends: 60, wider: 180 };   // suggestions only; person can change

/** Recompute last sent/received for people from contact_days of their linked handles. */
async function refresh(uid) {
  await pool.query(`
    UPDATE people p SET
      last_sent_at = GREATEST(p.last_sent_at, x.sent_at), last_received_at = GREATEST(p.last_received_at, x.recv_at)
    FROM (
      SELECT h.person_id,
        (MAX(d.day) FILTER (WHERE d.sent > 0))::timestamptz + interval '12 hours' AS sent_at,
        (MAX(d.day) FILTER (WHERE d.received > 0))::timestamptz + interval '12 hours' AS recv_at
      FROM person_handles h JOIN contact_days d ON d.kind=h.kind AND d.handle=h.handle AND d.user_id=h.user_id
      WHERE h.user_id=$1
      GROUP BY h.person_id) x
    WHERE p.id = x.person_id AND p.user_id=$1`, [uid]);
}

/** People overdue for their rhythm, and birthdays in the next 14 days. */
async function due(uid, limit = 5) {
  const { rows } = await pool.query(`
    SELECT id, name, ring, cadence_days, birthday, notes,
      GREATEST(last_sent_at, last_received_at) AS last_contact, last_sent_at, last_received_at
    FROM people WHERE user_id=$1 AND archived_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < CURRENT_DATE)`, [uid]);
  const now = Date.now();
  const today = new Date();
  const out = [];
  for (const p of rows) {
    const last = p.last_contact ? new Date(p.last_contact) : null;
    const days = last ? Math.floor((now - last) / 86400000) : null;
    let reason = null, score = 0;
    if (p.cadence_days && (days == null || days > p.cadence_days)) {
      reason = days == null ? 'no contact recorded yet' : `${days} days since you were last in touch (your rhythm: ~${p.cadence_days})`;
      score = days == null ? 1 : days / p.cadence_days;
    }
    if (p.birthday && /^\d{2}-\d{2}$/.test(p.birthday)) {
      const [m, d] = p.birthday.split('-').map(Number);
      let b = new Date(today.getFullYear(), m - 1, d);
      if (b < new Date(today.getFullYear(), today.getMonth(), today.getDate())) b = new Date(today.getFullYear() + 1, m - 1, d);
      const inDays = Math.round((b - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
      if (inDays <= 14) { reason = inDays === 0 ? 'birthday TODAY' : `birthday in ${inDays} day${inDays === 1 ? '' : 's'}`; score = 100 - inDays; }
    }
    // They messaged last and you haven't replied in 3+ days: a gentle "you might owe a reply".
    if (!reason && p.last_received_at && (!p.last_sent_at || new Date(p.last_received_at) > new Date(p.last_sent_at))) {
      const since = Math.floor((now - new Date(p.last_received_at)) / 86400000);
      if (since >= 3 && since <= 45) { reason = `they messaged ${since} days ago and you may not have replied`; score = 1 + since / 10; }
    }
    if (reason) out.push({ id: p.id, name: p.name, ring: p.ring, reason, days_since_contact: days, notes: p.notes || '', score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Add per-day counts (used by importers and the live link). rows: [{kind, handle, day, sent, received, display}] */
async function addContactDays(uid, rows, { replace = false } = {}) {
  for (const r of rows) {
    if (!r.handle || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) continue;
    await pool.query(`
      INSERT INTO contact_days(user_id, kind, handle, day, sent, received) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id, kind, handle, day) DO UPDATE SET
        sent = ${replace ? 'EXCLUDED.sent' : 'contact_days.sent + EXCLUDED.sent'},
        received = ${replace ? 'EXCLUDED.received' : 'contact_days.received + EXCLUDED.received'}`,
      [uid, r.kind, String(r.handle).slice(0, 120), r.day, r.sent | 0, r.received | 0]);
    if (r.display) {
      await pool.query(`INSERT INTO handle_names(user_id, kind, handle, display) VALUES ($1,$2,$3,$4)
                        ON CONFLICT (user_id, kind, handle) DO UPDATE SET display=COALESCE(EXCLUDED.display, handle_names.display)`,
        [uid, r.kind, String(r.handle).slice(0, 120), String(r.display).slice(0, 80)]);
    }
  }
  await refresh(uid);
}

/** Handles with the most contact that aren't linked to a person yet — for the "who is this?" list. */
async function unlinked(uid, limit = 40) {
  const { rows } = await pool.query(`
    SELECT d.kind, d.handle, n.display, SUM(d.sent + d.received)::int msgs, MAX(d.day)::text last_day,
      SUM(d.sent + d.received) FILTER (WHERE d.day > CURRENT_DATE - 365)::int last_year
    FROM contact_days d
    LEFT JOIN handle_names n ON n.user_id=d.user_id AND n.kind=d.kind AND n.handle=d.handle
    LEFT JOIN person_handles h ON h.user_id=d.user_id AND h.kind=d.kind AND h.handle=d.handle
    WHERE d.user_id=$1 AND h.person_id IS NULL
    GROUP BY d.kind, d.handle, n.display
    ORDER BY last_year DESC NULLS LAST, msgs DESC LIMIT $2`, [uid, limit]);
  return rows;
}

module.exports = { RING_CADENCE, refresh, due, addContactDays, unlinked };
