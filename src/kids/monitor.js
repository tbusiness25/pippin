/*
 * Monitoring log for a child (parents only). Scores come from an official questionnaire the parent or teacher fills
 * in elsewhere; this only keeps the number, the date and a note, so you can see how things change over time.
 */
const MEASURES = {
  sdq_total: { label: 'SDQ total difficulties', max: 40, help: 'From the SDQ parent form (total difficulties score, 0–40).' },
  sdq_impact: { label: 'SDQ impact', max: 10, help: 'The “impact” score on the SDQ form.' },
  vand_inattentive: { label: 'Vanderbilt: inattentive', max: 9, help: 'Count of symptoms marked “often” or “very often” (0–9).' },
  vand_hyperactive: { label: 'Vanderbilt: hyperactive/impulsive', max: 9, help: 'Count of symptoms marked “often” or “very often” (0–9).' },
  other: { label: 'Other (write it in the note)', max: 999, help: 'Anything else you want to track over time.' },
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;

module.exports = {
  MEASURES,
  routes(r, { pool, parentOnly }) {
    r.get('/monitor', parentOnly, async (req, res) => {
      const { rows } = await pool.query(`SELECT id, to_char(day,'YYYY-MM-DD') AS day, measure, score::float AS score, source, note FROM kid_monitor
        WHERE child_id=$1 AND removed_at IS NULL ORDER BY day, created_at`, [req.kid.id]);
      res.json({ ok: true, measures: MEASURES, entries: rows });
    });
    r.post('/monitor', parentOnly, async (req, res) => {
      const b = req.body || {};
      if (!MEASURES[b.measure]) return res.status(400).json({ ok: false, error: 'Pick what you’re recording' });
      const score = Number(b.score);
      if (!Number.isFinite(score) || score < 0 || score > MEASURES[b.measure].max) return res.status(400).json({ ok: false, error: `Score should be between 0 and ${MEASURES[b.measure].max}` });
      const day = DAY.test(b.day || '') ? b.day : new Date().toISOString().slice(0, 10);
      await pool.query(`INSERT INTO kid_monitor(child_id, day, measure, score, source, note) VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.kid.id, day, b.measure, score, b.source === 'teacher' ? 'teacher' : 'parent', b.note ? String(b.note).slice(0, 500) : null]);
      res.json({ ok: true });
    });
    r.delete('/monitor/:id', parentOnly, async (req, res) => {
      await pool.query('UPDATE kid_monitor SET removed_at=NOW() WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id]);
      res.json({ ok: true });
    });
  },
};
