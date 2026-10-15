/*
 * Kids: the daily self-care question. One gentle prompt a day (rotates through the child's active prompts),
 * answering earns 2 stars once a day and makes the sprig happy. Parents read the answers in Family.
 *
 * Safety: every answer is checked for difficult feelings — first the deterministic hard-block phrases
 * (self-harm etc., src/kids/safety.js), then the small classifier model if one is configured. A flagged answer
 * alerts the parents (util.alertParents) so they can have a gentle chat. If the model is unavailable the answer
 * stays "unchecked", and an outside flagger can pick it up through the hooks below (same JSON as before).
 */
const { addStars, balance, tx, isUuid } = require('./stars');

const SELFCARE_STARS = 2;
const MAX_CHARS = 2000;

// Generic, age-appropriate starter prompts. No labels, no diagnoses, no shame.
const DEFAULT_PROMPTS = [
  ['three_likes_about_self', 'Tell me three things you like about yourself.', 'kindness'],
  ['feeling_today', 'Name one feeling you had today. Was it big or small?', 'feelings'],
  ['who_to_talk_to', 'Who could you talk to if you felt sad or worried?', 'people'],
  ['proud_moment', 'Tell me about one thing you did this week that you feel proud of.', 'feelings'],
  ['kind_thing', 'What is one kind thing you did, or saw someone do, today?', 'kindness'],
  ['best_bit', 'What was the best bit of your day?', 'gratitude'],
  ['tricky_bit', 'Was there a tricky bit of your day? What happened?', 'feelings'],
  ['body_signal', 'How does your body feel right now? Tired, bouncy, calm, hungry?', 'body'],
  ['cheer_yourself', 'If you felt a bit flat, what is something that could cheer your brain up?', 'feelings'],
  ['grateful_person', 'Who is one person you are glad is in your life? Why?', 'gratitude'],
  ['something_new', 'Tell me about one new thing you learned today, even a tiny thing.', 'gratitude'],
  ['calm_place', 'Imagine somewhere that makes you feel safe and calm. Where is it?', 'feelings'],
  ['helped_someone', 'Did you help anyone today? Or did anyone help you?', 'kindness'],
  ['alarm_bell', 'Did your brain\'s alarm bell ring today? What set it off?', 'feelings'],
  ['breathe_count', 'Try a slow breath in for 4, out for 6. How did your body feel after?', 'body'],
  ['favourite_song', 'What is a song or sound that makes you feel happy right now?', 'gratitude'],
  ['hug_today', 'Did you have a hug today? Who from? How did it feel?', 'kindness'],
  ['want_to_try', 'Is there something new you would like to try one day?', 'feelings'],
  ['forgive_yourself', 'If something went wrong today, tell me one kind thing you would say to yourself.', 'kindness'],
  ['look_forward', 'What is one thing, big or small, that you are looking forward to?', 'gratitude'],
];
const CATEGORIES = ['kindness', 'feelings', 'gratitude', 'people', 'body', 'general'];

async function seedPrompts(pool, childId) {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM kid_selfcare_prompts WHERE child_id=$1', [childId]);
  if (n) return;
  for (const [i, [slug, text, cat]] of DEFAULT_PROMPTS.entries()) {
    await pool.query(`INSERT INTO kid_selfcare_prompts(child_id, slug, prompt_text, category, sort_order) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (child_id, slug) DO NOTHING`, [childId, slug, text, cat, (i + 1) * 10]);
  }
}

// Same prompt all day; advances at the child's local midnight.
async function todayPrompt(pool, kid, day) {
  const { rows } = await pool.query(`SELECT id, slug, prompt_text, category FROM kid_selfcare_prompts
    WHERE child_id=$1 AND active ORDER BY sort_order, slug`, [kid.id]);
  if (!rows.length) return null;
  const epochDay = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  return rows[((epochDay % rows.length) + rows.length) % rows.length];
}

/** Check one answer for difficult feelings; flag it and alert the parents if so. */
async function check({ pool, util }, kid, resp, promptText) {
  const safety = require('./safety');
  let difficult = false, reason = null, checked = false;
  const hard = safety.hardBlockCategory(resp.response_text);
  if (hard) { difficult = true; reason = `phrase:${hard.cat}`; checked = true; }
  else if (util.llmConfigured()) {
    const age = parseInt((((kid.settings || {}).kids) || {}).age, 10) || 7;
    try {
      const raw = await util.kidsLlm([{ role: 'user', content:
        `A ${age}-year-old answered a gentle daily self-care question in a family app.\nQuestion: ${promptText}\nAnswer: ${safety.redactPII(resp.response_text).slice(0, 1200)}\n\n` +
        'Reply ONLY with YES or NO. Does the answer show difficult feelings a parent should gently check in about — for example feeling very sad, scared, worried, lonely, hurt, left out, bullied, unsafe, or wanting to hurt themself? Ordinary small grumbles (tired, bored, a sibling was annoying) are NO.' }],
      { maxTokens: 6, temperature: 0, timeoutMs: 30000, model: process.env.KIDS_CLASSIFY_MODEL || undefined });
      const norm = String(raw).toUpperCase().replace(/[^A-Z]/g, '');
      if (norm.startsWith('YES')) { difficult = true; reason = 'classifier'; checked = true; }
      else if (norm.startsWith('NO')) checked = true;
    } catch (_) { /* leave unchecked — the outside flagger can still pick it up */ }
  }
  if (!checked) return;
  await pool.query(`UPDATE kid_selfcare_responses SET difficult_feelings=$2, flagged_at=NOW(), flag_reason=$3 WHERE id=$1 AND flagged_at IS NULL`,
    [resp.id, difficult, reason]);
  if (difficult) {
    util.audit(kid.id, 'selfcare_flag', { response: resp.id, reason });
    util.alertParents(`💛 ${kid.name} shared something on today's feelings question that might be worth a gentle chat.`,
      { tag: 'kids-care', url: `/#family/child/${kid.id}/care` });
  }
}

const responseCols = `r.id, r.response_text, r.responded_at, r.responded_date, r.parent_seen_at, r.difficult_feelings, r.flagged_at, r.flag_reason,
  p.slug AS prompt_slug, p.prompt_text, p.category`;

module.exports = {
  seedPrompts, DEFAULT_PROMPTS, check,

  routes(r, deps) {
    const { pool, sprig, util, parentOnly } = deps;

    r.get('/care/today', async (req, res) => {
      const kid = req.kid, day = util.localDate(kid.tz);
      await seedPrompts(pool, kid.id);
      const prompt = await todayPrompt(pool, kid, day);
      if (!prompt) return res.json({ ok: true, prompt: null });
      const { rows: [ex] } = await pool.query(`SELECT id, response_text, responded_at FROM kid_selfcare_responses
        WHERE child_id=$1 AND prompt_id=$2 AND responded_date=$3 ORDER BY responded_at DESC LIMIT 1`, [kid.id, prompt.id, day]);
      res.json({ ok: true, prompt, answered_today: !!ex, response: ex || null });
    });

    r.post('/care/respond', async (req, res) => {
      const kid = req.kid, day = util.localDate(kid.tz);
      const text = typeof (req.body || {}).response_text === 'string' ? req.body.response_text.trim().slice(0, MAX_CHARS) : '';
      if (!text) return res.status(400).json({ ok: false, error: 'Write a little something first' });
      const prompt = await todayPrompt(pool, kid, day);
      if (!prompt) return res.status(503).json({ ok: false, error: 'no_prompt' });
      try {
        const out = await tx(pool, async (c) => {
          await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kid-care:${kid.id}`]);
          const { rows: [dup] } = await c.query('SELECT id FROM kid_selfcare_responses WHERE child_id=$1 AND prompt_id=$2 AND responded_date=$3 LIMIT 1', [kid.id, prompt.id, day]);
          if (dup) return { ok: true, already_responded_today: true, response_id: dup.id, balance: await balance(c, kid.id) };
          const { rows: [resp] } = await c.query(`INSERT INTO kid_selfcare_responses(child_id, prompt_id, response_text, responded_date)
            VALUES ($1,$2,$3,$4) RETURNING id, responded_at, response_text`, [kid.id, prompt.id, text, day]);
          const bal = await addStars(c, kid.id, { source: 'selfcare', ref: resp.id, stars: SELFCARE_STARS, note: prompt.slug });
          return { ok: true, already_responded_today: false, response_id: resp.id, stars_awarded: SELFCARE_STARS, balance: bal, resp };
        });
        if (out.resp) {
          const resp = out.resp; delete out.resp;
          util.audit(req.uid, 'selfcare_respond', { child: kid.id, prompt_slug: prompt.slug, length: text.length });
          setImmediate(() => check(deps, kid, resp, prompt.prompt_text).catch((e) => console.error('[kids/care/check]', e.message)));
          out.sprig = await sprig.reward(kid.id, 'care', resp.id).catch(() => null);
        }
        res.json(out);
      } catch (e) { console.error('[kids/care/respond]', e.message); res.status(500).json({ ok: false, error: 'internal' }); }
    });

    // ---- Parent ----
    r.get('/care/responses', parentOnly, async (req, res) => {
      const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
      const { rows } = await pool.query(`SELECT ${responseCols} FROM kid_selfcare_responses r JOIN kid_selfcare_prompts p ON p.id=r.prompt_id
        WHERE r.child_id=$1 AND r.responded_at >= NOW() - make_interval(days => $2) ORDER BY r.responded_at DESC LIMIT 200`, [req.kid.id, days]);
      res.json({ ok: true, responses: rows, unseen: rows.filter((x) => !x.parent_seen_at).length });
    });
    r.post('/care/responses/:id/seen', parentOnly, async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`UPDATE kid_selfcare_responses SET parent_seen_at=COALESCE(parent_seen_at, NOW())
        WHERE id=$1 AND child_id=$2 RETURNING id, parent_seen_at`, [req.params.id, req.kid.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, response: rows[0] });
    });
    r.get('/care/prompts', parentOnly, async (req, res) => {
      await seedPrompts(pool, req.kid.id);
      const { rows } = await pool.query(`SELECT id, slug, prompt_text, category, active, sort_order FROM kid_selfcare_prompts
        WHERE child_id=$1 ORDER BY active DESC, sort_order, slug`, [req.kid.id]);
      res.json({ ok: true, prompts: rows });
    });
    r.post('/care/prompts', parentOnly, async (req, res) => {
      const text = String((req.body || {}).prompt_text || '').trim().slice(0, 300);
      if (!text) return res.status(400).json({ ok: false, error: 'Write the question' });
      const cat = CATEGORIES.includes(req.body.category) ? req.body.category : 'general';
      const slug = `p-${Math.random().toString(36).slice(2, 10)}`;
      const { rows: [p] } = await pool.query(`INSERT INTO kid_selfcare_prompts(child_id, slug, prompt_text, category, sort_order)
        VALUES ($1,$2,$3,$4, COALESCE((SELECT MAX(sort_order)+10 FROM kid_selfcare_prompts WHERE child_id=$1),10)) RETURNING id, prompt_text, category, active`,
      [req.kid.id, slug, text, cat]);
      res.json({ ok: true, prompt: p });
    });
    r.patch('/care/prompts/:id', parentOnly, async (req, res) => {
      const b = req.body || {};
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`UPDATE kid_selfcare_prompts SET prompt_text=COALESCE($3, prompt_text), active=COALESCE($4, active)
        WHERE id=$1 AND child_id=$2 RETURNING id, prompt_text, active`,
      [req.params.id, req.kid.id, typeof b.prompt_text === 'string' && b.prompt_text.trim() ? b.prompt_text.trim().slice(0, 300) : null,
        typeof b.active === 'boolean' ? b.active : null]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, prompt: rows[0] });
    });
  },

  // Outside flagger (an automation), same paths/JSON as the old family app's /api/parent/selfcare/*.
  hooks(r, deps) {
    const { pool, util } = deps;
    const childOnly = (req, res, next) => (req.hookUser.role === 'child' ? next() : res.status(404).json({ ok: false, error: 'not a child' }));
    r.get('/api/parent/selfcare/flag-candidates', childOnly, async (req, res) => {
      const { rows } = await pool.query(`SELECT r.id, r.response_text, r.responded_at, p.prompt_text, p.slug
        FROM kid_selfcare_responses r JOIN kid_selfcare_prompts p ON p.id=r.prompt_id
        WHERE r.child_id=$1 AND r.flagged_at IS NULL AND r.responded_at >= NOW() - INTERVAL '24 hours'
        ORDER BY r.responded_at ASC LIMIT 25`, [req.hookUser.id]);
      res.json({ ok: true, responses: rows });
    });
    r.post('/api/parent/selfcare/:id/flag', childOnly, async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const diff = !!(req.body || {}).difficult_feelings;
      const reason = typeof req.body.reason === 'string' ? req.body.reason.slice(0, 200) : null;
      const { rows: [before] } = await pool.query('SELECT difficult_feelings FROM kid_selfcare_responses WHERE id=$1 AND child_id=$2', [req.params.id, req.hookUser.id]);
      if (!before) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`UPDATE kid_selfcare_responses SET difficult_feelings=$3, flagged_at=NOW(), flag_reason=$4
        WHERE id=$1 AND child_id=$2 RETURNING id, difficult_feelings, flag_reason, response_text`, [req.params.id, req.hookUser.id, diff, reason]);
      if (diff && !before.difficult_feelings) {
        util.alertParents(`💛 ${req.hookUser.name} shared something on today's feelings question that might be worth a gentle chat.`,
          { tag: 'kids-care', url: `/#family/child/${req.hookUser.id}/care` });
      }
      res.json({ ok: true, response: rows[0] });
    });
    r.post('/api/parent/selfcare/:id/seen', childOnly, async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`UPDATE kid_selfcare_responses SET parent_seen_at=COALESCE(parent_seen_at, NOW())
        WHERE id=$1 AND child_id=$2 RETURNING id, parent_seen_at`, [req.params.id, req.hookUser.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, response: rows[0] });
    });
  },
};
