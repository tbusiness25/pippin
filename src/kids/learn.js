/*
 * Learn — short illustrated modules (a shared catalogue) a child explores; finishing one earns a little pocket
 * money ONCE (KIDS_STUDY_REWARD_PENCE, default 50) through the money module, plus a sprig reward.
 *
 * Safety: AI-drafted modules arrive as review_status='pending_review', published=false and are never shown to a
 * child until a parent approves them (a child sees only published AND approved — a double guard). Nothing here
 * ever approves automatically.
 *
 *   /api/kids/learn…                  child: browse, read, explored, complete
 *   /api/kids/learn/review…           parent: drafts → edit / approve / reject; ask for a new draft
 *   /hooks/:slug/api/admin/learn…     automations (same JSON as the old content admin API)
 * Audio and pictures: '/static/audio/learn/<file>' resolves to KIDS_DATA_DIR/learn/<file> (falling back to
 * the child's library folder); illustrations to KIDS_DATA_DIR/learn/img/<file>; http(s) URLs pass through.
 */
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./util');
const lib = require('./library');

const REWARD_PENCE = parseInt(process.env.KIDS_STUDY_REWARD_PENCE || '50', 10);
const TOPICS = [
  { id: 'heart', title: 'Big Heart', emoji: '💛' },
  { id: 'wonder', title: 'Wonder Lab', emoji: '🔬' },
  { id: 'brain', title: 'How your brain works', emoji: '🧠' },
  { id: 'feelings', title: 'Feelings', emoji: '🌈' },
  { id: 'thinking', title: 'Thinking', emoji: '💡' },
  { id: 'body', title: 'Your body', emoji: '🫀' },
];
const TOPIC_IDS = TOPICS.map((t) => t.id);
const REVIEW = ['pending_review', 'approved', 'rejected'];
const LIVE = `m.published AND m.review_status='approved' AND m.removed_at IS NULL`;
const ADMIN_COLS = `id, slug, topic, title, sort_order, body, illustration_path, audio_path, audio_status, published, review_status,
                    draft_source, draft_topic_prompt, created_at`;

let money = null;
try { money = require('./money'); } catch (_) { money = null; }

function learnFile(sub, p, child) {
  const rel = lib.relOf(p);
  if (!rel) return null;
  const base = dataDir('learn');
  const name = rel.replace(/^learn\//, '');
  const shared = path.join(base, sub, name);
  if (shared.startsWith(path.join(base, sub) + path.sep) && fs.existsSync(shared)) return shared;
  return child ? lib.fileFor(child, rel) : null;
}
const isUrl = (s) => /^https?:\/\//i.test(String(s || ''));
function present(m) {
  const out = { ...m };
  out.audio_url = m.audio_path && m.audio_status === 'ready' ? `/api/kids/learn/${encodeURIComponent(m.slug)}/audio` : null;
  out.illustration_url = m.illustration_path ? (isUrl(m.illustration_path) ? m.illustration_path : `/api/kids/learn/${encodeURIComponent(m.slug)}/illustration`) : null;
  delete out.audio_path; delete out.illustration_path;
  return out;
}

async function upsertModule(pool, m) {
  const reviewStatus = m.review_status && REVIEW.includes(m.review_status) ? m.review_status : 'approved';
  const published = reviewStatus === 'approved' && m.published === true;   // a draft is never published
  const { rows } = await pool.query(
    `INSERT INTO kid_learn_module(slug, topic, title, sort_order, body, illustration_path, audio_path, audio_status, published,
                                  review_status, draft_source, draft_topic_prompt)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,COALESCE($8,'none'),$9,$10,$11,$12)
     ON CONFLICT (slug) DO UPDATE SET topic=EXCLUDED.topic, title=EXCLUDED.title, sort_order=EXCLUDED.sort_order, body=EXCLUDED.body,
       illustration_path=EXCLUDED.illustration_path, audio_path=COALESCE($7, kid_learn_module.audio_path),
       audio_status=COALESCE($8, kid_learn_module.audio_status), published=EXCLUDED.published, review_status=EXCLUDED.review_status,
       draft_source=COALESCE(EXCLUDED.draft_source, kid_learn_module.draft_source),
       draft_topic_prompt=COALESCE(EXCLUDED.draft_topic_prompt, kid_learn_module.draft_topic_prompt), removed_at=NULL
     RETURNING id, slug, topic, title, published, review_status, draft_source`,
    [m.slug, m.topic, m.title, m.sort_order || 0, JSON.stringify(m.body), m.illustration_path || null, m.audio_path || null,
      m.audio_status || null, published, reviewStatus, m.draft_source || null, m.draft_topic_prompt || null]);
  return rows[0];
}

async function editModule(pool, id, m) {
  if (m.topic && !TOPIC_IDS.includes(m.topic)) return { error: 'bad_topic' };
  if (m.body && !Array.isArray(m.body)) return { error: 'body_must_be_array' };
  const { rows } = await pool.query(
    `UPDATE kid_learn_module SET title=COALESCE($2, title), topic=COALESCE($3, topic), sort_order=COALESCE($4, sort_order),
            body=COALESCE($5::jsonb, body), illustration_path=COALESCE($6, illustration_path)
      WHERE id=$1 AND removed_at IS NULL RETURNING id, slug, topic, title, review_status, published`,
    [id, typeof m.title === 'string' ? m.title.slice(0, 200) : null, m.topic || null, Number.isInteger(m.sort_order) ? m.sort_order : null,
      Array.isArray(m.body) ? JSON.stringify(m.body) : null, typeof m.illustration_path === 'string' ? m.illustration_path : null]);
  return { module: rows[0] };
}

async function review(pool, id, approve, by) {
  const { rows } = await pool.query(
    `UPDATE kid_learn_module SET review_status=$2, published=$3, reviewed_by=$4, reviewed_at=NOW()
      WHERE id=$1 AND removed_at IS NULL RETURNING id, slug, review_status, published`,
    [id, approve ? 'approved' : 'rejected', !!approve, by || null]);
  return rows[0] || null;
}

async function listAdmin(pool, status) {
  const params = [];
  let where = 'removed_at IS NULL';
  if (status !== 'all') { params.push(status); where += ' AND review_status=$1'; }
  const { rows } = await pool.query(`SELECT ${ADMIN_COLS} FROM kid_learn_module WHERE ${where} ORDER BY created_at DESC LIMIT 100`, params);
  return rows;
}

module.exports = {
  TOPICS,

  routes(r, { pool, sprig, parentOnly }) {
    // ---- parent review (registered first so '/learn/review' isn't taken for a slug) ----
    r.get('/learn/review', parentOnly, async (req, res) => {
      const status = req.query.status || 'pending_review';
      if (![...REVIEW, 'all'].includes(status)) return res.status(400).json({ ok: false, error: 'bad_status' });
      res.json({ ok: true, modules: (await listAdmin(pool, status)).map(present), topics: TOPICS, draftsEnabled: !!process.env.KIDS_LEARN_DRAFT_WEBHOOK });
    });
    r.patch('/learn/review/:id', parentOnly, async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'Not found' });
      const out = await editModule(pool, req.params.id, req.body || {});
      if (out.error) return res.status(400).json({ ok: false, error: out.error });
      if (!out.module) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, module: out.module });
    });
    r.post('/learn/review/:id/:action(approve|reject)', parentOnly, async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'Not found' });
      const m = await review(pool, req.params.id, req.params.action === 'approve', req.uid);
      if (!m) return res.status(404).json({ ok: false, error: 'Not found' });
      require('./util').audit(req.uid, `learn_${req.params.action}`, { module: m.slug, child: req.kid.id });
      res.json({ ok: true, module: m });
    });
    // Ask the drafting automation for a new module on a topic. It posts the draft back via the hook as pending_review.
    r.post('/learn/review/draft', parentOnly, async (req, res) => {
      const topic = String((req.body || {}).topic || '').trim().slice(0, 300);
      const group = String((req.body || {}).topic_group || '').trim();
      if (!topic) return res.status(400).json({ ok: false, error: 'What should it be about?' });
      if (!TOPIC_IDS.includes(group)) return res.status(400).json({ ok: false, error: 'Pick a section' });
      const hook = process.env.KIDS_LEARN_DRAFT_WEBHOOK;
      if (!hook) return res.status(503).json({ ok: false, error: 'Drafting isn’t set up (KIDS_LEARN_DRAFT_WEBHOOK)' });
      try {
        const r2 = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, topic_group: group, child_slug: req.kid.slug || null }), signal: AbortSignal.timeout(90000) });
        const draft = await r2.json().catch(() => null);
        res.json({ ok: true, dispatched: true, status: r2.status, draft });
      } catch (e) { res.status(502).json({ ok: false, error: 'The drafting service didn’t answer' }); }
    });

    // ---- child ----
    r.get('/learn', async (req, res) => {
      const { rows } = await pool.query(
        `SELECT m.id, m.slug, m.topic, m.title, m.sort_order, m.illustration_path, m.audio_path, m.audio_status,
                (p.child_id IS NOT NULL) AS explored, (p.completed_at IS NOT NULL OR lr.child_id IS NOT NULL) AS completed
           FROM kid_learn_module m
           LEFT JOIN kid_learn_progress p ON p.module_id=m.id AND p.child_id=$1
           LEFT JOIN kid_learn_reward lr ON lr.module_id=m.id AND lr.child_id=$1
          WHERE ${LIVE} ORDER BY m.topic, m.sort_order, m.title`, [req.kid.id]);
      const topics = {};
      for (const m of rows) (topics[m.topic] = topics[m.topic] || []).push(present(m));
      res.json({ ok: true, topics, topic_meta: TOPICS, reward_pence: money ? REWARD_PENCE : 0 });
    });
    const one = async (slug, kidId) => {
      const { rows: [m] } = await pool.query(
        `SELECT m.id, m.slug, m.topic, m.title, m.body, m.illustration_path, m.audio_path, m.audio_status,
                (p.child_id IS NOT NULL) AS explored, (p.completed_at IS NOT NULL OR lr.child_id IS NOT NULL) AS completed
           FROM kid_learn_module m
           LEFT JOIN kid_learn_progress p ON p.module_id=m.id AND p.child_id=$2
           LEFT JOIN kid_learn_reward lr ON lr.module_id=m.id AND lr.child_id=$2
          WHERE m.slug=$1 AND ${LIVE}`, [slug, kidId]);
      return m || null;
    };
    r.get('/learn/:slug', async (req, res) => {
      const m = await one(req.params.slug, req.kid.id);
      if (!m) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, module: present(m), reward_pence: money ? REWARD_PENCE : 0 });
    });
    r.get('/learn/:slug/audio', async (req, res) => {
      const { rows: [m] } = await pool.query(`SELECT audio_path, published, review_status FROM kid_learn_module m WHERE slug=$1 AND removed_at IS NULL`, [req.params.slug]);
      if (!m || !m.audio_path || (!req.asParent && !(m.published && m.review_status === 'approved'))) return res.status(404).json({ ok: false, error: 'Not found' });
      lib.sendAudio(res, learnFile('', m.audio_path, req.kid.id));
    });
    r.get('/learn/:slug/illustration', async (req, res) => {
      const { rows: [m] } = await pool.query(`SELECT illustration_path, published, review_status FROM kid_learn_module WHERE slug=$1 AND removed_at IS NULL`, [req.params.slug]);
      if (!m || !m.illustration_path || (!req.asParent && !(m.published && m.review_status === 'approved'))) return res.status(404).end();
      const f = learnFile('img', String(m.illustration_path).replace(/^\/?static\/learn\//, ''), null);
      if (!f || !/\.(png|jpe?g|webp|gif|svg)$/i.test(f)) return res.status(404).end();
      res.sendFile(f, { headers: { 'Cache-Control': 'private, max-age=86400' } });
    });
    r.post('/learn/:slug/explored', async (req, res) => {
      const m = await one(req.params.slug, req.kid.id);
      if (!m) return res.status(404).json({ ok: false, error: 'Not found' });
      if (!req.asParent) await pool.query('INSERT INTO kid_learn_progress(child_id, module_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.kid.id, m.id]);
      res.json({ ok: true });
    });
    // Finish a module: pocket money once (never twice), plus a little something for the sprig.
    r.post('/learn/:slug/complete', async (req, res) => {
      if (req.asParent) return res.status(403).json({ ok: false, error: 'Only the child can finish a module' });
      const kid = req.kid;
      const m = await one(req.params.slug, kid.id);
      if (!m) return res.status(404).json({ ok: false, error: 'Not found' });
      await pool.query(`INSERT INTO kid_learn_progress(child_id, module_id, completed_at) VALUES ($1,$2,NOW())
                        ON CONFLICT (child_id, module_id) DO UPDATE SET completed_at=COALESCE(kid_learn_progress.completed_at, NOW())`, [kid.id, m.id]);
      let rewarded = false, balance = null;
      const { rows: [had] } = await pool.query('SELECT 1 FROM kid_learn_reward WHERE child_id=$1 AND module_id=$2', [kid.id, m.id]);
      if (!had && money && REWARD_PENCE > 0) {
        try {
          const c = await money.credit(kid.id, REWARD_PENCE, 'study_reward', m.id, `Finished: ${m.title}`);   // idempotent on (source, ref)
          const { rowCount } = await pool.query('INSERT INTO kid_learn_reward(child_id, module_id, pence) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [kid.id, m.id, REWARD_PENCE]);
          rewarded = !!(c && c.credited !== false) && rowCount > 0;
          balance = c && c.balance != null ? c.balance : null;
        } catch (e) { console.error('[learn] money credit failed:', e.message); }
      }
      const reward = await sprig.reward(kid.id, 'learn', m.id);
      res.json({ ok: true, rewarded, pence: rewarded ? REWARD_PENCE : 0, total: balance, sprig: reward });
    });
  },

  hooks(r, { pool }) {
    // POST { slug, topic, title, sort_order?, body, illustration_path?, audio_path?, audio_status?, published?, review_status?,
    //        draft_source?, draft_topic_prompt? }
    r.post('/api/admin/learn', async (req, res) => {
      const m = req.body || {};
      if (!m.slug || !m.topic || !m.title || !Array.isArray(m.body)) return res.status(400).json({ ok: false, error: 'slug_topic_title_body_required' });
      if (!TOPIC_IDS.includes(m.topic)) return res.status(400).json({ ok: false, error: 'bad_topic' });
      res.json({ ok: true, module: await upsertModule(pool, m) });
    });
    r.get('/api/admin/learn', async (req, res) => {
      const status = req.query.status || 'pending_review';
      if (![...REVIEW, 'all'].includes(status)) return res.status(400).json({ ok: false, error: 'bad_status' });
      res.json({ ok: true, modules: await listAdmin(pool, status) });
    });
    r.get('/api/admin/learn/:id', async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`SELECT ${ADMIN_COLS} FROM kid_learn_module WHERE id=$1 AND removed_at IS NULL LIMIT 1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, module: rows[0] });
    });
    r.patch('/api/admin/learn/:id', async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const out = await editModule(pool, req.params.id, req.body || {});
      if (out.error) return res.status(400).json({ ok: false, error: out.error });
      if (!out.module) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, module: out.module });
    });
    r.post('/api/admin/learn/:id/:action(approve|reject)', async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const m = await review(pool, req.params.id, req.params.action === 'approve', null);
      if (!m) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, module: m });
    });
    // Soft delete (the old API hard-deleted; rows here are only hidden).
    r.delete('/api/admin/learn/:id', async (req, res) => {
      if (!lib.UUID_RE.test(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`UPDATE kid_learn_module SET removed_at=NOW(), published=FALSE WHERE id=$1 AND removed_at IS NULL RETURNING id, slug`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, deleted: rows[0] });
    });
    r.post('/api/admin/learn/:slug/audio', async (req, res) => {
      const { audio_path, audio_status } = req.body || {};
      const { rows } = await pool.query(
        `UPDATE kid_learn_module SET audio_path=COALESCE($2, audio_path), audio_status=COALESCE($3, audio_status)
          WHERE slug=$1 AND removed_at IS NULL RETURNING id, slug, audio_path, audio_status`, [req.params.slug, audio_path || null, audio_status || null]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, module: rows[0] });
    });
    // Publishing is only possible for an approved module (a draft stays hidden).
    r.post('/api/admin/learn/:slug/:action(publish|unpublish)', async (req, res) => {
      const pub = req.params.action === 'publish';
      const { rows } = await pool.query(
        `UPDATE kid_learn_module SET published=$2 WHERE slug=$1 AND removed_at IS NULL AND ($2 = FALSE OR review_status='approved')
          RETURNING id, slug, published`, [req.params.slug, pub]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, module: rows[0] });
    });
  },
};
