/*
 * Kids: stars and rewards.
 *
 * Stars are earned by chores and the daily self-care question (src/kids/chores.js, care.js) and live in an
 * append-only ledger per child (balance = SUM(stars)). Each child has their own rewards catalogue. A child
 * can ASK for a reward once they have enough stars; a parent decides (approved / talk_first / declined /
 * completed). Nothing auto-redeems: stars are only taken away when a parent marks the reward "completed"
 * (the treat actually happened). Sprig acorns/energy never convert to stars, and stars never become money.
 *
 * Also hosts the weekly summary hook an automation can poll (same JSON as the old family app).
 */

// Generic starter catalogue for a child who has none yet (parents edit/remove freely).
const DEFAULT_REWARDS = [
  ['extra_screen_30min', 'Extra screen time (30 mins)', 'Half an hour extra on a game or show, on top of the usual.', '🎮', 10],
  ['treat_meal', 'A treat meal out', 'Pick somewhere for a special meal.', '🍟', 40],
  ['cinema_trip', 'Cinema trip', 'Go and see a film at the cinema.', '🎬', 80],
  ['big_day_out', 'Big day out', 'A whole day somewhere exciting.', '🎢', 200],
];
const DECISIONS = ['approved', 'declined', 'talk_first', 'completed'];

/** Serialise ledger writes for one child inside a transaction. */
const lockChild = (client, childId, what = 'stars') => client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kid-${what}:${childId}`]);

async function balance(client, childId) {
  const { rows: [r] } = await client.query('SELECT COALESCE(SUM(stars),0)::int AS b FROM kid_star_ledger WHERE child_id=$1', [childId]);
  return r.b;
}

/** Add (or with negative stars, spend) stars. Call inside a transaction. Returns the new balance. */
async function addStars(client, childId, { source, ref = null, stars, note = null }) {
  await lockChild(client, childId);
  const after = (await balance(client, childId)) + stars;
  await client.query(`INSERT INTO kid_star_ledger(child_id, source, source_ref, stars, balance_after, note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [childId, source, ref == null ? null : String(ref), stars, after, note]);
  return after;
}

async function tx(pool, fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

async function parentName(pool, uid) {
  const { rows: [u] } = await pool.query('SELECT name FROM users WHERE id=$1', [uid]);
  return u ? u.name : null;
}

async function seedRewards(pool, childId) {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM kid_rewards WHERE child_id=$1', [childId]);
  if (n) return;
  for (const [i, [slug, title, desc, emoji, stars]] of DEFAULT_REWARDS.entries()) {
    await pool.query(`INSERT INTO kid_rewards(child_id, slug, title, description, icon_emoji, stars_required, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (child_id, slug) DO NOTHING`, [childId, slug, title, desc, emoji, stars, (i + 1) * 10]);
  }
}

const slugify = (t) => `${String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'item'}-${Math.random().toString(36).slice(2, 6)}`;
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ''));

async function weeklySummary(pool, child) {
  const today = require('./util').localDate(child.tz);
  const b = await balance(pool, child.id);
  const { rows: [poss] } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN frequency='daily' THEN 7 ELSE 0 END),0)::int AS total FROM kid_chores WHERE child_id=$1 AND active`, [child.id]);
  const { rows: [done] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM kid_chore_completions WHERE child_id=$1 AND removed_at IS NULL
        AND completed_date >= $2::date - 6 AND completed_date <= $2::date`, [child.id, today]);
  const { rows: [sc] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM kid_selfcare_responses WHERE child_id=$1 AND responded_at >= NOW() - INTERVAL '7 days'`, [child.id]);
  const { rows: [earned] } = await pool.query(
    `SELECT COALESCE(SUM(stars),0)::int AS n FROM kid_star_ledger WHERE child_id=$1 AND created_at >= NOW() - INTERVAL '7 days' AND stars > 0`, [child.id]);
  const { rows: pend } = await pool.query(
    `SELECT rw.title AS reward_title FROM kid_reward_requests rr JOIN kid_rewards rw ON rw.id=rr.reward_id
      WHERE rr.child_id=$1 AND rr.parent_decision='pending' ORDER BY rr.requested_at DESC LIMIT 5`, [child.id]);
  return { ok: true, balance: b, chores_done: done.n, chores_possible: poss.total, selfcare_count: sc.n,
    stars_earned: earned.n, pending_rewards: pend.map((r) => r.reward_title) };
}

module.exports = {
  balance, addStars, lockChild, tx, parentName, seedRewards, slugify, isUuid, weeklySummary, DEFAULT_REWARDS,

  routes(r, { pool, parentOnly, util }) {
    r.get('/stars', async (req, res) => {
      res.json({ ok: true, balance: await balance(pool, req.kid.id) });
    });

    r.get('/stars/ledger', async (req, res) => {
      const { rows } = await pool.query(`SELECT id, source, source_ref, stars, balance_after, note, created_at FROM kid_star_ledger
        WHERE child_id=$1 ORDER BY created_at DESC, id DESC LIMIT 40`, [req.kid.id]);
      res.json({ ok: true, balance: await balance(pool, req.kid.id), ledger: rows });
    });

    // Child: the rewards they can work towards + where each one's latest request stands.
    r.get('/rewards', async (req, res) => {
      const kid = req.kid;
      await seedRewards(pool, kid.id);
      const b = await balance(pool, kid.id);
      const { rows } = await pool.query(
        `SELECT r.id, r.slug, r.title, r.description, r.icon_emoji, r.stars_required, r.sort_order,
                rr.id AS request_id, rr.parent_decision, rr.parent_decision_at, rr.parent_note, rr.requested_at, rr.stars_at_request
           FROM kid_rewards r
           LEFT JOIN LATERAL (SELECT id, parent_decision, parent_decision_at, parent_note, requested_at, stars_at_request
                                FROM kid_reward_requests WHERE reward_id=r.id ORDER BY requested_at DESC LIMIT 1) rr ON TRUE
          WHERE r.child_id=$1 AND r.active ORDER BY r.sort_order, r.stars_required`, [kid.id]);
      res.json({ ok: true, balance: b, rewards: rows.map((x) => ({
        id: x.id, slug: x.slug, title: x.title, description: x.description, icon_emoji: x.icon_emoji, stars_required: x.stars_required,
        progress: Math.min(b, x.stars_required),
        can_request: b >= x.stars_required && (!x.parent_decision || ['declined', 'completed'].includes(x.parent_decision)),
        latest_request: x.request_id ? { id: x.request_id, parent_decision: x.parent_decision, parent_decision_at: x.parent_decision_at,
          parent_note: x.parent_note, requested_at: x.requested_at, stars_at_request: x.stars_at_request } : null,
      })) });
    });

    // Child: "Ask a grown-up". Never redeems anything — a parent decides later.
    r.post('/rewards/:id/request', async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const kid = req.kid;
      try {
        const out = await tx(pool, async (c) => {
          const { rows: [rw] } = await c.query('SELECT id, slug, title, stars_required FROM kid_rewards WHERE id=$1 AND child_id=$2 AND active', [req.params.id, kid.id]);
          if (!rw) return { status: 404, body: { ok: false, error: 'not_found' } };
          await lockChild(c, kid.id);
          const b = await balance(c, kid.id);
          if (b < rw.stars_required) return { status: 409, body: { ok: false, error: 'Not enough stars yet — keep going!', balance: b, stars_required: rw.stars_required } };
          const { rows: pend } = await c.query(`SELECT 1 FROM kid_reward_requests WHERE reward_id=$1 AND parent_decision IN ('pending','approved','talk_first') LIMIT 1`, [rw.id]);
          if (pend.length) return { status: 409, body: { ok: false, error: 'Already asked — a grown-up will look soon' } };
          const { rows: [ins] } = await c.query(`INSERT INTO kid_reward_requests(child_id, reward_id, stars_at_request) VALUES ($1,$2,$3)
            RETURNING id, requested_at, parent_decision, stars_at_request`, [kid.id, rw.id, b]);
          return { status: 200, body: { ok: true, request: ins, balance: b }, audit: { reward_slug: rw.slug, balance: b } };
        });
        if (out.audit) util.audit(req.uid, 'reward_request', { child: kid.id, ...out.audit });
        res.status(out.status).json(out.body);
      } catch (e) { console.error('[kids/rewards/request]', e.message); res.status(500).json({ ok: false, error: 'internal' }); }
    });

    // ---- Parent ----
    r.get('/rewards/requests', parentOnly, async (req, res) => {
      const { rows } = await pool.query(
        `SELECT rr.id, rr.parent_decision, rr.parent_decision_at, rr.parent_note, rr.requested_at, rr.stars_at_request, rr.parent_user,
                rw.id AS reward_id, rw.slug AS reward_slug, rw.title AS reward_title, rw.icon_emoji, rw.stars_required
           FROM kid_reward_requests rr JOIN kid_rewards rw ON rw.id=rr.reward_id
          WHERE rr.child_id=$1 AND (rr.parent_decision IN ('pending','talk_first','approved') OR rr.requested_at >= NOW() - INTERVAL '30 days')
          ORDER BY (rr.parent_decision='pending') DESC, rr.requested_at DESC LIMIT 40`, [req.kid.id]);
      res.json({ ok: true, balance: await balance(pool, req.kid.id), requests: rows });
    });

    r.post('/rewards/requests/:id/decide', parentOnly, async (req, res) => {
      const b = req.body || {};
      if (!DECISIONS.includes(b.decision)) return res.status(400).json({ ok: false, error: 'bad_decision' });
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 500) : null;
      const who = await parentName(pool, req.uid);
      try {
        const out = await tx(pool, async (c) => {
          const { rows: [rq] } = await c.query('SELECT id, reward_id, parent_decision FROM kid_reward_requests WHERE id=$1 AND child_id=$2 FOR UPDATE', [req.params.id, req.kid.id]);
          if (!rq) return { status: 404, body: { ok: false, error: 'not_found' } };
          if (rq.parent_decision === 'completed') return { status: 409, body: { ok: false, error: 'Already completed' } };
          const { rows: [upd] } = await c.query(`UPDATE kid_reward_requests SET parent_decision=$2, parent_decision_at=NOW(),
              parent_note=COALESCE($3, parent_note), parent_user=$4, decided_by=$5 WHERE id=$1
            RETURNING id, parent_decision, parent_decision_at, parent_note, parent_user`, [rq.id, b.decision, note, who, req.uid]);
          // Only "completed" (the treat actually happened) spends the stars.
          let bal = null;
          if (b.decision === 'completed') {
            const { rows: [rw] } = await c.query('SELECT stars_required, slug FROM kid_rewards WHERE id=$1', [rq.reward_id]);
            if (rw) bal = await addStars(c, req.kid.id, { source: 'reward_redeem', ref: rq.id, stars: -Math.abs(rw.stars_required), note: rw.slug });
          }
          return { status: 200, body: { ok: true, request: upd, ...(bal != null ? { balance: bal } : {}) } };
        });
        if (out.status === 200) util.audit(req.uid, 'reward_decide', { child: req.kid.id, request: req.params.id, decision: b.decision });
        res.status(out.status).json(out.body);
      } catch (e) { console.error('[kids/rewards/decide]', e.message); res.status(500).json({ ok: false, error: 'internal' }); }
    });

    // Parent: manage this child's rewards catalogue (soft delete = active false).
    r.get('/rewards/manage', parentOnly, async (req, res) => {
      await seedRewards(pool, req.kid.id);
      const { rows } = await pool.query(`SELECT id, slug, title, description, icon_emoji, stars_required, active, sort_order
        FROM kid_rewards WHERE child_id=$1 ORDER BY active DESC, sort_order, stars_required`, [req.kid.id]);
      res.json({ ok: true, rewards: rows });
    });
    r.post('/rewards', parentOnly, async (req, res) => {
      const b = req.body || {};
      const title = String(b.title || '').trim().slice(0, 80);
      const stars = parseInt(b.stars_required, 10);
      if (!title || !(stars > 0 && stars <= 10000)) return res.status(400).json({ ok: false, error: 'A title and a star count please' });
      const { rows: [rw] } = await pool.query(`INSERT INTO kid_rewards(child_id, slug, title, description, icon_emoji, stars_required, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6, COALESCE((SELECT MAX(sort_order)+10 FROM kid_rewards WHERE child_id=$1),10))
        RETURNING id, title, stars_required, active`, [req.kid.id, slugify(title), title, b.description ? String(b.description).slice(0, 300) : null,
        String(b.icon_emoji || '🎁').slice(0, 8), stars]);
      res.json({ ok: true, reward: rw });
    });
    r.patch('/rewards/:id', parentOnly, async (req, res) => {
      const b = req.body || {};
      const sets = [], vals = [req.params.id, req.kid.id];
      const set = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
      if (typeof b.title === 'string' && b.title.trim()) set('title', b.title.trim().slice(0, 80));
      if (b.stars_required != null) { const s = parseInt(b.stars_required, 10); if (!(s > 0 && s <= 10000)) return res.status(400).json({ ok: false, error: 'bad_stars' }); set('stars_required', s); }
      if (typeof b.icon_emoji === 'string') set('icon_emoji', b.icon_emoji.slice(0, 8));
      if (typeof b.description === 'string') set('description', b.description.slice(0, 300));
      if (typeof b.active === 'boolean') set('active', b.active);
      if (!sets.length || !isUuid(req.params.id)) return res.status(400).json({ ok: false, error: 'no_fields' });
      const { rows } = await pool.query(`UPDATE kid_rewards SET ${sets.join(', ')} WHERE id=$1 AND child_id=$2 RETURNING id, title, stars_required, active`, vals);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, reward: rows[0] });
    });
    r.delete('/rewards/:id', parentOnly, async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rowCount } = await pool.query('UPDATE kid_rewards SET active=FALSE WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id]);
      res.status(rowCount ? 200 : 404).json({ ok: !!rowCount });
    });

    // Parent: a manual correction (e.g. a kind thing done that isn't a chore). No shame: parents add, they don't fine.
    r.post('/stars/adjust', parentOnly, async (req, res) => {
      const stars = parseInt((req.body || {}).stars, 10);
      if (!Number.isFinite(stars) || !stars || Math.abs(stars) > 1000) return res.status(400).json({ ok: false, error: 'bad_amount' });
      const note = String((req.body || {}).note || 'From a grown-up').slice(0, 200);
      const bal = await tx(pool, (c) => addStars(c, req.kid.id, { source: 'adjust', stars, note }));
      util.audit(req.uid, 'stars_adjust', { child: req.kid.id, stars });
      res.json({ ok: true, balance: bal });
    });

    r.get('/stars/weekly-summary', parentOnly, async (req, res) => res.json(await weeklySummary(pool, req.kid)));
  },

  hooks(r, { pool }) {
    // Same JSON as the old family app's /api/parent/weekly-summary (a weekly automation reads it).
    r.get('/api/parent/weekly-summary', async (req, res) => {
      if (req.hookUser.role !== 'child') return res.status(404).json({ ok: false, error: 'not a child' });
      res.json(await weeklySummary(pool, req.hookUser));
    });
  },
};
