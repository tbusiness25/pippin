/*
 * Collection — a searchable catalogue of things the child collects, with favourites ("my picks") and a short guide.
 * The catalogue and pictures are not shipped with the app: put them in KIDS_DATA_DIR/collection/
 *   catalogue.json  { "title": "…", "item": "…", "subtitle": "…", "filters": [["<area>", "<chip label>"]], "areas": { "<area>": "<emoji>" }, "typeColours": { "<type>": "#hex" },
 *                     "guide": { "intro", "areas": [{ emoji, title, biome, likes }], "tips": [{ emoji, text }] },
 *                     "entries": [{ "num", "national_num", "name", "types": [], "generation", "is_legendary", "habitat",
 *                                   "form_note", "sprite": "<file>" }] }
 *   sprites/<file>  pictures (served to signed-in family members only)
 * The catalogue is (re)loaded into kid_collection at startup. Without it the module just says "nothing here yet".
 */
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./util');

let meta = { title: 'Collection', item: 'items', subtitle: '', areas: {}, filters: [], typeColours: {}, guide: null };
const SPRITE_RE = /^[\w-]{1,60}\.(png|webp|jpe?g|gif)$/i;

async function load(pool) {
  const f = dataDir('collection', 'catalogue.json');
  if (!fs.existsSync(f)) { console.log('[kids/collection] no catalogue — skipping'); return; }
  const cat = JSON.parse(fs.readFileSync(f, 'utf8'));
  meta = { title: cat.title || meta.title, item: cat.item || meta.item, subtitle: cat.subtitle || '', areas: cat.areas || {},
    filters: Array.isArray(cat.filters) ? cat.filters : [], typeColours: cat.typeColours || {}, guide: cat.guide || null };
  let n = 0;
  for (const p of cat.entries || []) {
    if (!Number.isInteger(p.num) || !p.name) continue;
    await pool.query(
      `INSERT INTO kid_collection(num, national_num, name, types, generation, is_legendary, habitat, form_note, sprite, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (num) DO UPDATE SET national_num=EXCLUDED.national_num, name=EXCLUDED.name, types=EXCLUDED.types,
         generation=EXCLUDED.generation, is_legendary=EXCLUDED.is_legendary, habitat=EXCLUDED.habitat, form_note=EXCLUDED.form_note,
         sprite=EXCLUDED.sprite, updated_at=NOW()`,
      [p.num, p.national_num ?? null, String(p.name), JSON.stringify(p.types || []), p.generation || 0, !!p.is_legendary,
        p.habitat || null, p.form_note || null, p.sprite && SPRITE_RE.test(p.sprite) ? p.sprite : null]);
    n++;
  }
  console.log(`[kids/collection] catalogue: ${n} entries`);
}

module.exports = {
  start({ pool }) { load(pool).catch((e) => console.error('[kids/collection] load failed:', e.message)); },

  routes(r, { pool, sprig }) {
    r.get('/collection', async (req, res) => {
      const { rows } = await pool.query(
        `SELECT p.num AS id, p.num, p.national_num, p.name, p.types, p.generation, p.is_legendary, p.habitat, p.form_note, p.sprite,
                (f.child_id IS NOT NULL) AS favourite
           FROM kid_collection p LEFT JOIN kid_collection_favourite f ON f.num=p.num AND f.child_id=$1 AND f.removed_at IS NULL
          ORDER BY p.num`, [req.kid.id]);
      res.json({ ok: true, count: rows.length, items: rows, meta: { title: meta.title, item: meta.item, subtitle: meta.subtitle, areas: meta.areas, filters: meta.filters, typeColours: meta.typeColours, hasGuide: !!meta.guide } });
    });
    r.get('/collection/guide', (req, res) => res.json({ ok: true, guide: meta.guide }));
    r.get('/collection/sprites/:file', (req, res) => {
      if (!SPRITE_RE.test(req.params.file)) return res.status(404).end();
      const f = path.join(dataDir('collection', 'sprites'), req.params.file);
      if (!fs.existsSync(f)) return res.status(404).end();
      res.sendFile(f, { headers: { 'Cache-Control': 'private, max-age=604800' } });
    });
    // Toggle "in my team". Removing only hides the row (soft), so adding again is the same row.
    r.post('/collection/:num/favourite', async (req, res) => {
      const num = parseInt(req.params.num, 10);
      if (!Number.isInteger(num)) return res.status(400).json({ ok: false, error: 'bad_id' });
      const { rows: [p] } = await pool.query('SELECT num FROM kid_collection WHERE num=$1', [num]);
      if (!p) return res.status(404).json({ ok: false, error: 'Not found' });
      const { rows: [cur] } = await pool.query('SELECT removed_at FROM kid_collection_favourite WHERE child_id=$1 AND num=$2', [req.kid.id, num]);
      const nowFav = !cur || cur.removed_at != null;
      await pool.query(
        `INSERT INTO kid_collection_favourite(child_id, num) VALUES ($1,$2)
         ON CONFLICT (child_id, num) DO UPDATE SET removed_at = CASE WHEN $3 THEN NULL ELSE NOW() END`, [req.kid.id, num, nowFav]);
      const reward = nowFav && !req.asParent ? await sprig.reward(req.kid.id, 'collection', num) : null;
      res.json({ ok: true, favourite: nowFav, sprig: reward });
    });
  },
};
