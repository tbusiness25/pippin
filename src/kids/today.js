/*
 * "Today" — a little morning paper for a child, written each morning by an automation:
 *   POST /hooks/:slug/api/admin/morning-paper  { paper_date: 'YYYY-MM-DD', content: { <section>: … } }
 * A section's value is a string or { headline, body, word, meaning, example, question, answer, audio_path }.
 * Known sections get a friendly title; any others are shown with a title made from their key, or one set in
 * KIDS_DATA_DIR/today.json: { "<child slug>": { "sections": [{ "key": "…", "emoji": "…", "title": "…" }] } }.
 * An audio_path in a section plays the matching approved item from the child's library.
 */
const fs = require('fs');
const { dataDir, localDate } = require('./util');

const DEFAULT_SECTIONS = [
  { key: 'fact', emoji: '🔭', title: 'Fact of the day' },
  { key: 'word_of_day', emoji: '📖', title: 'Word of the day' },
  { key: 'maths_warmup', emoji: '➕', title: 'Maths warm-up' },
  { key: 'joke', emoji: '😄', title: 'Joke of the day' },
  { key: 'weather', emoji: '🌤️', title: 'Weather' },
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sectionsFor(slug) {
  let custom = [];
  try {
    const all = JSON.parse(fs.readFileSync(dataDir('today.json'), 'utf8'));
    custom = ((all[String(slug || '').toLowerCase()] || {}).sections || []).filter((s) => s && s.key);
  } catch (_) { /* no config */ }
  const keys = new Set(custom.map((s) => s.key));
  return [...custom, ...DEFAULT_SECTIONS.filter((s) => !keys.has(s.key))];
}

module.exports = {
  routes(r, { pool }) {
    r.get('/today', async (req, res) => {
      const kid = req.kid;
      const day = localDate(kid.tz);
      const { rows: [paper] } = await pool.query(
        'SELECT paper_date, content, created_at FROM kid_morning_paper WHERE child_id=$1 AND paper_date=$2', [kid.id, day]);
      const audio = {};
      if (paper && paper.content && typeof paper.content === 'object') {
        for (const [k, v] of Object.entries(paper.content)) {
          if (!v || typeof v !== 'object' || !v.audio_path) continue;
          const { rows: [it] } = await pool.query(
            `SELECT id FROM library_item WHERE user_id=$1 AND audio_path=$2 AND approved AND rejected_at IS NULL AND removed_at IS NULL AND audio_status='ready'
              ORDER BY created_at DESC LIMIT 1`, [kid.id, v.audio_path]);
          if (it) audio[k] = it.id;
        }
      }
      res.json({ ok: true, date: day, paper: paper || null, sections: sectionsFor(kid.slug), audio });
    });
  },

  hooks(r, { pool }) {
    r.post('/api/admin/morning-paper', async (req, res) => {
      const { paper_date, content } = req.body || {};
      if (!paper_date || !content) return res.status(400).json({ ok: false, error: 'fields_required' });
      if (!DATE_RE.test(String(paper_date)) || typeof content !== 'object') return res.status(400).json({ ok: false, error: 'fields_required' });
      const { rows } = await pool.query(
        `INSERT INTO kid_morning_paper(child_id, paper_date, content) VALUES ($1,$2,$3::jsonb)
         ON CONFLICT (child_id, paper_date) DO UPDATE SET content=EXCLUDED.content, created_at=NOW()
         RETURNING id, paper_date`, [req.hookUser.id, paper_date, JSON.stringify(content)]);
      res.json({ ok: true, paper: rows[0] });
    });
  },
};
