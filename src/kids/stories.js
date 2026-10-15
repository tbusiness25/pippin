/*
 * "Make me a story" — a child orders a bedtime story; a worker outside the app writes and narrates it.
 *
 * The app only writes the order down (kid_story_request). The worker (any language, on any host) talks to
 * the hooks API with HOOKS_TOKEN:
 *   POST /hooks/:slug/api/stories/next      claim the oldest queued request (reclaims 'working' rows older
 *                                            than 45 min first) → { story, child, labels } or { story: null }
 *   POST /hooks/:slug/api/stories/:id       { status: working|ready|failed, title, transcript, duration_s,
 *                                            audio_path, yoto_card_id, generated_by, error }
 *                                            — 'ready' with an audio_path also files it in the child's library
 *                                            (audio under LIBRARY_DIR/<childId>/, e.g. 'stories/<file>.wav')
 *   POST /hooks/:slug/api/stories/bedtime   queue a random combination not used in the last 10 days
 *   GET  /hooks/:slug/api/stories           recent requests
 * One story in flight per child (partial unique index). Options are served from here so the picker and
 * the worker can never disagree; extra per-child options can be added in KIDS_DATA_DIR/stories.json:
 *   { "<child slug>": { "setting": [{ "id": "…", "label": "…", "emoji": "…", "describe": "…" }], … } }
 */
const fs = require('fs');
const lib = require('./library');

const STALE_MIN = 45;
const GROUPS = ['theme', 'characters', 'setting', 'plot'];

// label = what the child sees; describe = what the story writer is told.
const BASE = {
  theme: [
    { id: 'adventure', label: 'A big adventure', emoji: '🗺️', describe: 'a big adventure' },
    { id: 'mystery', label: 'A mystery to solve', emoji: '🔍', describe: 'a mystery to solve' },
    { id: 'funny', label: 'Something really silly', emoji: '🤪', describe: 'something really silly' },
    { id: 'space', label: 'Out in space', emoji: '🚀', describe: 'outer space' },
    { id: 'magic', label: 'Magic and spells', emoji: '✨', describe: 'magic and spells' },
    { id: 'animals', label: 'Animals in charge', emoji: '🦊', describe: 'animals in charge' },
    { id: 'pirates', label: 'Pirates and treasure', emoji: '🏴‍☠️', describe: 'pirates and treasure' },
    { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦕', describe: 'dinosaurs' },
    { id: 'football', label: 'Football', emoji: '⚽', describe: 'football' },
    { id: 'spooky', label: 'A bit spooky (not scary)', emoji: '👻', describe: 'gently spooky, never frightening' },
  ],
  characters: [
    { id: 'me', label: 'Me!', emoji: '🧒', describe: 'the child listening' },
    { id: 'best_friend', label: 'My best friend', emoji: '🧑‍🤝‍🧑', describe: 'their best friend' },
    { id: 'dog', label: 'A clever dog', emoji: '🐕', describe: 'a clever dog' },
    { id: 'cat', label: 'A grumpy cat', emoji: '🐈', describe: 'a grumpy cat' },
    { id: 'robot', label: 'A robot', emoji: '🤖', describe: 'a robot' },
    { id: 'dragon', label: 'A small dragon', emoji: '🐉', describe: 'a small dragon' },
    { id: 'alien', label: 'A friendly alien', emoji: '👽', describe: 'a friendly alien' },
    { id: 'inventor', label: 'A mad inventor', emoji: '🔬', describe: 'a mad inventor' },
    { id: 'pirate_captain', label: 'A pirate captain', emoji: '🦜', describe: 'a pirate captain' },
    { id: 'wizard', label: 'A forgetful wizard', emoji: '🧙', describe: 'a forgetful wizard' },
  ],
  setting: [
    { id: 'jungle', label: 'A thick jungle', emoji: '🌴', describe: 'a thick jungle' },
    { id: 'space_station', label: 'A space station', emoji: '🛰️', describe: 'a space station' },
    { id: 'underwater', label: 'Under the sea', emoji: '🐠', describe: 'under the sea' },
    { id: 'castle', label: 'An old castle', emoji: '🏰', describe: 'an old castle' },
    { id: 'school', label: 'School, but weird', emoji: '🏫', describe: 'a school where something is not quite right' },
    { id: 'mountain', label: 'A snowy mountain', emoji: '🏔️', describe: 'a snowy mountain' },
    { id: 'island', label: 'A desert island', emoji: '🏝️', describe: 'a desert island' },
    { id: 'city_night', label: 'A city at night', emoji: '🌃', describe: 'a city at night' },
    { id: 'home', label: 'Our house', emoji: '🏠', describe: 'an ordinary family house' },
  ],
  plot: [
    { id: 'lost_thing', label: 'Something important goes missing', emoji: '❓', describe: 'something important goes missing' },
    { id: 'race', label: 'A race against the clock', emoji: '⏱️', describe: 'a race against the clock' },
    { id: 'rescue', label: 'Somebody needs rescuing', emoji: '🆘', describe: 'somebody needs rescuing' },
    { id: 'puzzle', label: 'A puzzle nobody can crack', emoji: '🧩', describe: 'a puzzle nobody can crack' },
    { id: 'new_friend', label: 'Making an unlikely friend', emoji: '🤝', describe: 'an unlikely friendship forms' },
    { id: 'big_mistake', label: 'A mistake that makes things worse', emoji: '😬', describe: 'a mistake that makes everything worse before it gets better' },
    { id: 'secret_door', label: 'A door that should not be there', emoji: '🚪', describe: 'a door appears where no door should be' },
    { id: 'swap', label: 'Two people swap places', emoji: '🔄', describe: 'two characters swap places' },
  ],
  length: [
    { id: 5, label: 'Short — about 5 minutes' },
    { id: 10, label: 'Normal — about 10 minutes' },
    { id: 15, label: 'Long — about 15 minutes' },
  ],
};

let extraCache = { mtime: 0, data: {} };
function extras(slug) {
  try {
    const f = require('./util').dataDir('stories.json');
    const st = fs.statSync(f);
    if (st.mtimeMs !== extraCache.mtime) extraCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(f, 'utf8')) };
  } catch (_) { extraCache = { mtime: 0, data: {} }; }
  const e = (slug && extraCache.data[String(slug).toLowerCase()]) || {};
  return e;
}

const kidsProfile = (kid) => ((kid.settings || {}).kids || {});
function optionsFor(kid) {
  const ex = extras(kid.slug);
  const out = {};
  for (const g of [...GROUPS, 'length']) {
    const more = Array.isArray(ex[g]) ? ex[g].filter((o) => o && o.id != null && o.label).map((o) => ({ id: String(o.id), label: String(o.label), emoji: o.emoji || '✨', describe: o.describe || String(o.label) })) : [];
    out[g] = [...BASE[g], ...more];
  }
  const p = kidsProfile(kid);
  out.characters = out.characters.map((c) => (c.id === 'me'
    ? { ...c, label: `Me (${kid.name})`, describe: `${kid.name} — the child listening${p.age ? `, aged ${p.age}` : ''}` } : c));
  return out;
}
const publicOptions = (o) => Object.fromEntries(Object.entries(o).map(([g, list]) => [g, list.map(({ describe, ...rest }) => rest)]));
const ids = (opts, g) => new Set(opts[g].map((o) => String(o.id)));
const describe = (opts, g, id) => (opts[g].find((o) => String(o.id) === String(id)) || {}).describe || String(id).replace(/_/g, ' ');

const LIST_SQL = `SELECT s.id, s.status, s.theme, s.characters, s.setting, s.plot, s.length_min, s.extra, s.source, s.title,
         s.duration_s, s.error, s.created_at, s.finished_at, s.yoto_card_id, s.library_item_id,
         (l.id IS NOT NULL AND l.audio_status='ready' AND l.approved AND l.rejected_at IS NULL) AS playable
    FROM kid_story_request s LEFT JOIN library_item l ON l.id = s.library_item_id AND l.removed_at IS NULL
   WHERE s.child_id=$1 ORDER BY s.created_at DESC LIMIT 30`;

async function queue(pool, kidId, f) {
  try {
    const { rows: [s] } = await pool.query(
      `INSERT INTO kid_story_request(child_id, theme, characters, setting, plot, length_min, extra, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, status, created_at`,
      [kidId, f.theme, f.characters, f.setting, f.plot, f.length_min, f.extra || null, f.source]);
    return s;
  } catch (e) { if (e.code === '23505') return null; throw e; }
}

/** A random combination the child hasn't had in the last 10 days. */
async function randomCombo(pool, kid) {
  const opts = optionsFor(kid);
  const { rows } = await pool.query(`SELECT theme, setting, plot FROM kid_story_request WHERE child_id=$1 AND created_at > NOW() - interval '10 days'`, [kid.id]);
  const recent = new Set(rows.map((r) => `${r.theme}|${r.setting}|${r.plot}`));
  const any = (g) => opts[g][Math.floor(Math.random() * opts[g].length)].id;
  let pick;
  for (let i = 0; i < 40; i++) { pick = { theme: any('theme'), setting: any('setting'), plot: any('plot') }; if (!recent.has(`${pick.theme}|${pick.setting}|${pick.plot}`)) break; }
  const sidekicks = ['dog', 'best_friend', 'robot', 'dragon', 'cat'].filter((c) => ids(opts, 'characters').has(c));
  const characters = Math.random() < 0.2 || !sidekicks.length ? ['me'] : ['me', sidekicks[Math.floor(Math.random() * sidekicks.length)]];
  return { ...pick, characters, length_min: 10 };
}

module.exports = {
  optionsFor,

  routes(r, { pool, parentOnly }) {
    r.get('/stories/options', (req, res) => res.json({ ok: true, options: publicOptions(optionsFor(req.kid)) }));

    r.get('/stories', async (req, res) => {
      const { rows } = await pool.query(LIST_SQL, [req.kid.id]);
      res.json({ ok: true, stories: rows, busy: rows.some((s) => s.status === 'queued' || s.status === 'working') });
    });

    r.post('/stories', async (req, res) => {
      const b = req.body || {};
      const opts = optionsFor(req.kid);
      const theme = String(b.theme || ''), setting = String(b.setting || ''), plot = String(b.plot || '');
      const lengthMin = parseInt(b.length_min, 10);
      const chars = Array.isArray(b.characters) ? [...new Set(b.characters.map(String))].slice(0, 3) : [];
      const extra = String(b.extra || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
      const bad = (code, error) => res.status(400).json({ ok: false, code, error });
      if (!ids(opts, 'theme').has(theme)) return bad('bad_theme', 'Pick what it’s about');
      if (!ids(opts, 'setting').has(setting)) return bad('bad_setting', 'Pick where it happens');
      if (!ids(opts, 'plot').has(plot)) return bad('bad_plot', 'Pick what happens');
      if (!ids(opts, 'length').has(String(lengthMin))) return bad('bad_length', 'Pick how long');
      if (!chars.length) return bad('pick_a_character', 'Pick who is in it');
      if (!chars.every((c) => ids(opts, 'characters').has(c))) return bad('bad_character', 'Pick who is in it');
      const s = await queue(pool, req.kid.id, { theme, setting, plot, characters: chars, length_min: lengthMin, extra, source: req.asParent ? 'parent' : 'child' });
      if (!s) return res.status(409).json({ ok: false, code: 'already_making_one', error: 'One story is already being made — it’s nearly ready!' });
      res.json({ ok: true, story: s });
    });

    // Parent: a surprise story now, cancel a queued one, try a failed one again.
    r.post('/stories/surprise', parentOnly, async (req, res) => {
      const s = await queue(pool, req.kid.id, { ...(await randomCombo(pool, req.kid)), source: 'parent' });
      if (!s) return res.status(409).json({ ok: false, code: 'already_making_one', error: 'A story is already queued' });
      res.json({ ok: true, story: s });
    });
    r.post('/stories/:id/cancel', parentOnly, async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'Not found' });
      const { rowCount } = await pool.query(`UPDATE kid_story_request SET status='cancelled', updated_at=NOW() WHERE id=$1 AND child_id=$2 AND status='queued'`, [req.params.id, req.kid.id]);
      res.json({ ok: true, cancelled: rowCount > 0 });
    });
    r.post('/stories/:id/retry', parentOnly, async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'Not found' });
      const { rows: [o] } = await pool.query(`SELECT * FROM kid_story_request WHERE id=$1 AND child_id=$2 AND status='failed'`, [req.params.id, req.kid.id]);
      if (!o) return res.status(404).json({ ok: false, error: 'Nothing to retry' });
      const s = await queue(pool, req.kid.id, { ...o, source: o.source });
      if (!s) return res.status(409).json({ ok: false, code: 'already_making_one', error: 'A story is already queued' });
      res.json({ ok: true, story: s });
    });
  },

  hooks(r, { pool, sprig }) {
    const childOnly = (req, res, next) => (req.hookUser.role === 'child' ? next() : res.status(400).json({ ok: false, error: 'stories are for a child' }));

    r.get('/api/stories', childOnly, async (req, res) => {
      const { rows } = await pool.query(LIST_SQL, [req.hookUser.id]);
      res.json({ ok: true, stories: rows });
    });

    r.post('/api/stories/next', childOnly, async (req, res) => {
      const kid = req.hookUser;
      const { rowCount } = await pool.query(
        `UPDATE kid_story_request SET status='queued', started_at=NULL, updated_at=NOW()
          WHERE child_id=$1 AND status='working' AND started_at < NOW() - make_interval(mins => $2)`, [kid.id, STALE_MIN]);
      const { rows: [s] } = await pool.query(
        `UPDATE kid_story_request SET status='working', started_at=NOW(), updated_at=NOW()
          WHERE id = (SELECT id FROM kid_story_request WHERE child_id=$1 AND status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING *`, [kid.id]);
      const p = kidsProfile(kid);
      const child = { id: kid.id, name: kid.name, age: p.age || null, pronouns: p.pronouns || null };
      if (!s) return res.json({ ok: true, story: null, reclaimed: rowCount, child });
      const opts = optionsFor(kid);
      res.json({ ok: true, reclaimed: rowCount, child, story: s,
        labels: { theme: describe(opts, 'theme', s.theme), characters: (s.characters || []).map((c) => describe(opts, 'characters', c)),
          setting: describe(opts, 'setting', s.setting), plot: describe(opts, 'plot', s.plot) },
        library: { user_id: kid.id, dir: 'stories' } });
    });

    r.post('/api/stories/bedtime', childOnly, async (req, res) => {
      const { rows: [busy] } = await pool.query(`SELECT id FROM kid_story_request WHERE child_id=$1 AND status IN ('queued','working') LIMIT 1`, [req.hookUser.id]);
      if (busy) return res.json({ ok: true, queued: false, reason: 'already_queued' });
      const combo = await randomCombo(pool, req.hookUser);
      const s = await queue(pool, req.hookUser.id, { ...combo, source: 'nightly' });
      res.json({ ok: true, queued: !!s, story: s ? { ...s, ...combo } : null });
    });

    const update = async (req, res) => {
      const kid = req.hookUser;
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const b = req.body || {};
      if (!['working', 'ready', 'failed'].includes(b.status)) return res.status(400).json({ ok: false, error: 'bad_status' });
      const { rows: [s] } = await pool.query('SELECT * FROM kid_story_request WHERE id=$1 AND child_id=$2', [req.params.id, kid.id]);
      if (!s) return res.status(404).json({ ok: false, error: 'not_found' });
      if (b.audio_path && !lib.relOf(b.audio_path)) return res.status(400).json({ ok: false, error: 'bad_audio_path' });

      let itemId = s.library_item_id;
      const title = b.title ? String(b.title).slice(0, 200) : s.title;
      const duration = Number.isFinite(+b.duration_s) && +b.duration_s > 0 ? Math.round(+b.duration_s) : s.duration_s;
      if (b.status === 'ready' && b.audio_path && !itemId) {
        const item = await lib.createItem(pool, kid.id, { kind: 'story', title: title || 'A bedtime story', transcript: b.transcript,
          audio_path: b.audio_path, duration_s: duration, generated_by: b.generated_by || 'story-worker', audio_status: 'ready', approved: true });
        itemId = item.id;
      }
      const { rows: [u] } = await pool.query(
        `UPDATE kid_story_request SET status=$3, title=COALESCE($4, title), transcript=COALESCE($5, transcript), duration_s=$6,
                library_item_id=$7, yoto_card_id=COALESCE($8, yoto_card_id), error=$9,
                started_at = CASE WHEN $3='working' THEN COALESCE(started_at, NOW()) ELSE started_at END,
                finished_at = CASE WHEN $3 IN ('ready','failed') THEN NOW() ELSE finished_at END, updated_at=NOW()
          WHERE id=$1 AND child_id=$2 RETURNING *`,
        [s.id, kid.id, b.status, title || null, b.transcript || null, duration || null, itemId, b.yoto_card_id || null,
          b.status === 'failed' ? String(b.error || 'failed').slice(0, 500) : null]);
      let reward = null;
      if (b.status === 'ready' && s.source === 'child') reward = await sprig.reward(kid.id, 'story', s.id).catch(() => null);
      res.json({ ok: true, story: u, library_item_id: itemId, sprig: reward });
    };
    r.post('/api/stories/:id', update);
    r.patch('/api/stories/:id', update);
  },
};
