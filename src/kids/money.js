/*
 * Kids: pocket money. All amounts are integer PENCE.
 *
 *   total     = SUM(kid_money_ledger.pence)                    — all real money in/out
 *   earmarked = SUM(saved_pence of the child's active pots)    — money set aside in savings pots
 *   spendable = total − earmarked
 *
 * Moving money into or out of a pot is an earmark only (no ledger row). Real money only changes through
 * the ledger: weekly allowance, parent adjustments, rewards from other modules via credit() (e.g. 50p for a
 * finished study module), and parent-approved spends. Sprig/game rewards NEVER touch this.
 *
 * Other modules: require('./money').credit(childId, pence, source, ref, note) — idempotent on (source, ref).
 */
const { tx, parentName, isUuid } = require('./stars');

const DEFAULT_ALLOWANCE = parseInt(process.env.KIDS_ALLOWANCE_PENCE || '500', 10);
const MAX = 1000000;   // £10,000 sanity cap

const lockMoney = (c, childId) => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kid-money:${childId}`]);

async function total(c, childId) {
  const { rows: [r] } = await c.query('SELECT COALESCE(SUM(pence),0)::int AS t FROM kid_money_ledger WHERE child_id=$1', [childId]);
  return r.t;
}
async function summary(c, childId) {
  const t = await total(c, childId);
  const { rows: [e] } = await c.query('SELECT COALESCE(SUM(saved_pence),0)::int AS e FROM kid_money_goals WHERE child_id=$1 AND active', [childId]);
  return { total: t, earmarked: e.e, spendable: t - e.e };
}

/** Write a ledger row inside a transaction (locks the child's money). Returns { credited, balance }. */
async function creditIn(c, childId, { pence, source, ref = null, note = null, by = null }) {
  await lockMoney(c, childId);
  if (ref != null) {
    const { rows } = await c.query('SELECT 1 FROM kid_money_ledger WHERE child_id=$1 AND source=$2 AND source_ref=$3', [childId, source, String(ref)]);
    if (rows.length) return { credited: false, balance: await total(c, childId) };
  }
  const after = (await total(c, childId)) + pence;
  await c.query(`INSERT INTO kid_money_ledger(child_id, source, source_ref, pence, balance_after, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [childId, source, ref == null ? null : String(ref).slice(0, 200), pence, after, note, by]);
  return { credited: true, balance: after };
}

/**
 * Public: credit (or debit, with negative pence) a child's pocket money. Idempotent on (source, ref):
 * calling twice with the same ref pays once. Returns { ok, credited, balance }.
 */
async function credit(childId, pence, source, ref = null, note = null) {
  const { pool } = require('../db');
  pence = Math.round(Number(pence));
  if (!childId || !Number.isFinite(pence) || !pence || Math.abs(pence) > MAX || !source) throw new Error('bad credit');
  const r = await tx(pool, (c) => creditIn(c, childId, { pence, source: String(source).slice(0, 40), ref, note }));
  return { ok: true, ...r };
}

const parsePence = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n <= MAX ? n : null; };
const goalSlug = (t) => `g-${String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;

async function seedPots(pool, childId) {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM kid_money_goals WHERE child_id=$1', [childId]);
  if (n) return;
  await pool.query(`INSERT INTO kid_money_goals(child_id, slug, title, kind, target_pence, icon_emoji, created_by, sort_order)
    VALUES ($1,'long-term-savings','Long-term savings','long',NULL,'🏦','parent',0) ON CONFLICT (child_id, slug) DO NOTHING`, [childId]);
}

async function goals(c, childId) {
  const { rows } = await c.query(`SELECT id, slug, title, kind, target_pence, saved_pence, icon_emoji, created_by, sort_order, achieved_at
    FROM kid_money_goals WHERE child_id=$1 AND active ORDER BY (kind='long') DESC, sort_order, created_at`, [childId]);
  return rows.map((g) => ({ ...g,
    pct: g.target_pence ? Math.min(100, Math.round((g.saved_pence / g.target_pence) * 100)) : null,
    funded: g.target_pence ? g.saved_pence >= g.target_pence : g.saved_pence > 0 }));
}

async function allowanceFor(pool, childId) {
  const { rows: [s] } = await pool.query('SELECT allowance_pence FROM kid_money_settings WHERE child_id=$1', [childId]);
  return s ? s.allowance_pence : DEFAULT_ALLOWANCE;
}

async function payAllowance(pool, childId, body, by) {
  const pence = parseInt((body && body.pence) || await allowanceFor(pool, childId), 10);
  if (!Number.isFinite(pence) || pence <= 0 || pence > 100000) return { status: 400, body: { ok: false, error: 'bad_amount' } };
  const ref = body && typeof body.ref === 'string' && body.ref ? body.ref.slice(0, 40) : null;
  const r = await tx(pool, (c) => creditIn(c, childId, { pence, source: 'allowance', ref, note: 'Weekly pocket money 💷', by }));
  if (!r.credited) return { status: 200, body: { ok: true, skipped: 'already_paid', ref } };
  return { status: 200, body: { ok: true, credited: pence, balance: r.balance } };
}

async function parentSummary(pool, childId) {
  await seedPots(pool, childId);
  const s = await summary(pool, childId);
  const { rows: payouts } = await pool.query(`SELECT p.id, p.goal_id, p.amount_pence, p.status, p.requested_at, p.decided_at, p.parent_note, p.parent_user,
      g.title AS goal_title, g.icon_emoji
    FROM kid_money_payout_requests p LEFT JOIN kid_money_goals g ON g.id=p.goal_id
    WHERE p.child_id=$1 AND (p.status='pending' OR p.requested_at >= NOW() - INTERVAL '30 days')
    ORDER BY (p.status='pending') DESC, p.requested_at DESC LIMIT 30`, [childId]);
  const { rows: ledger } = await pool.query(`SELECT source, source_ref, pence, balance_after, note, created_at
    FROM kid_money_ledger WHERE child_id=$1 ORDER BY created_at DESC, id DESC LIMIT 30`, [childId]);
  return { ok: true, ...s, goals: await goals(pool, childId), payouts, ledger, allowance_pence: await allowanceFor(pool, childId) };
}

module.exports = {
  credit, summary, total, creditIn, seedPots,

  routes(r, { pool, sprig, util, parentOnly }) {
    const err = (res, e, where) => { console.error(`[kids/money/${where}]`, e.message); res.status(500).json({ ok: false, error: 'internal' }); };

    // Everything the child's money screen needs.
    r.get('/money', async (req, res) => {
      const kid = req.kid;
      try {
        await seedPots(pool, kid.id);
        const s = await summary(pool, kid.id);
        const { rows: ledger } = await pool.query(`SELECT source, pence, balance_after, note, created_at FROM kid_money_ledger
          WHERE child_id=$1 ORDER BY created_at DESC, id DESC LIMIT 15`, [kid.id]);
        const { rows: payouts } = await pool.query(`SELECT p.id, p.goal_id, p.amount_pence, p.status, p.requested_at, p.parent_note,
            g.title AS goal_title, g.icon_emoji
          FROM kid_money_payout_requests p LEFT JOIN kid_money_goals g ON g.id=p.goal_id
          WHERE p.child_id=$1 AND p.status IN ('pending','approved') ORDER BY p.requested_at DESC LIMIT 10`, [kid.id]);
        const { rows: [sr] } = await pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(pence),0)::int AS pence FROM kid_money_ledger
          WHERE child_id=$1 AND source='study_reward'`, [kid.id]);
        res.json({ ok: true, ...s, goals: await goals(pool, kid.id), ledger, payouts, study_rewards: sr });
      } catch (e) { err(res, e, 'summary'); }
    });

    // New savings pot (a thing to save for). Parents can make one too.
    r.post('/money/goals', async (req, res) => {
      const b = req.body || {};
      const title = String(b.title || '').trim().slice(0, 60);
      if (!title) return res.status(400).json({ ok: false, error: 'What are you saving for?' });
      const target = parsePence(b.target_pence);
      if (!target) return res.status(400).json({ ok: false, error: 'How much does it cost?' });
      try {
        const { rows: [g] } = await pool.query(`INSERT INTO kid_money_goals(child_id, slug, title, kind, target_pence, icon_emoji, created_by, sort_order)
          VALUES ($1,$2,$3,'short',$4,$5,$6, COALESCE((SELECT MAX(sort_order)+1 FROM kid_money_goals WHERE child_id=$1),1))
          RETURNING id, slug, title, kind, target_pence, saved_pence, icon_emoji`,
        [req.kid.id, goalSlug(title), title, target, String(b.icon_emoji || '🎯').slice(0, 8), req.asParent ? 'parent' : 'child']);
        const sp = await sprig.reward(req.kid.id, 'savings_pot', g.id).catch(() => null);
        res.json({ ok: true, goal: g, sprig: sp });
      } catch (e) { err(res, e, 'goal-create'); }
    });

    r.patch('/money/goals/:id', async (req, res) => {
      const b = req.body || {};
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 60) : null;
      const target = b.target_pence != null ? parsePence(b.target_pence) : null;
      if (b.target_pence != null && !target) return res.status(400).json({ ok: false, error: 'bad_target' });
      const icon = typeof b.icon_emoji === 'string' ? b.icon_emoji.slice(0, 8) : null;
      const { rows } = await pool.query(`UPDATE kid_money_goals SET title=COALESCE($3,title), target_pence=COALESCE($4,target_pence), icon_emoji=COALESCE($5,icon_emoji)
        WHERE id=$1 AND child_id=$2 AND active RETURNING id, slug, title, kind, target_pence, saved_pence, icon_emoji`, [req.params.id, req.kid.id, title, target, icon]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, goal: rows[0] });
    });

    // Remove a short-term pot (soft); its money goes back to spendable. The long-term pot stays.
    r.delete('/money/goals/:id', async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`UPDATE kid_money_goals SET active=FALSE, saved_pence=0
        WHERE id=$1 AND child_id=$2 AND active AND kind='short'
          AND NOT EXISTS (SELECT 1 FROM kid_money_payout_requests WHERE goal_id=$1 AND status='pending') RETURNING id`, [req.params.id, req.kid.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found_or_protected' });
      res.json({ ok: true });
    });

    // Put money into a pot (earmark only — capped by spendable and by what the pot still needs).
    r.post('/money/goals/:id/allocate', async (req, res) => {
      const kid = req.kid;
      const pence = parsePence((req.body || {}).pence);
      if (!pence || !isUuid(req.params.id)) return res.status(400).json({ ok: false, error: 'bad_amount' });
      try {
        const out = await tx(pool, async (c) => {
          await lockMoney(c, kid.id);
          const { rows: [g] } = await c.query('SELECT id, target_pence, saved_pence, achieved_at FROM kid_money_goals WHERE id=$1 AND child_id=$2 AND active FOR UPDATE', [req.params.id, kid.id]);
          if (!g) return { status: 404, body: { ok: false, error: 'not_found' } };
          const { spendable } = await summary(c, kid.id);
          let add = Math.min(pence, spendable);
          if (g.target_pence != null) add = Math.min(add, g.target_pence - g.saved_pence);
          if (add <= 0) return { status: 409, body: { ok: false, error: 'nothing_to_add', spendable } };
          const { rows: [upd] } = await c.query(`UPDATE kid_money_goals SET saved_pence=saved_pence+$2,
              achieved_at = CASE WHEN target_pence IS NOT NULL AND saved_pence+$2 >= target_pence THEN COALESCE(achieved_at, NOW()) ELSE achieved_at END
            WHERE id=$1 RETURNING id, saved_pence, target_pence, achieved_at`, [g.id, add]);
          return { status: 200, body: { ok: true, goal: upd, moved: add }, reached: !g.achieved_at && upd.achieved_at };
        });
        if (out.status !== 200) return res.status(out.status).json(out.body);
        Object.assign(out.body, await summary(pool, kid.id));
        out.body.sprig = await (out.reached
          ? sprig.reward(kid.id, 'savings_goal', out.body.goal.id)
          : sprig.reward(kid.id, 'money_saved', `${out.body.goal.id}:${util.localDate(kid.tz)}`)).catch(() => null);
        res.json(out.body);
      } catch (e) { err(res, e, 'allocate'); }
    });

    // Take money back out of a pot to spendable.
    r.post('/money/goals/:id/withdraw', async (req, res) => {
      const pence = parsePence((req.body || {}).pence);
      if (!pence || !isUuid(req.params.id)) return res.status(400).json({ ok: false, error: 'bad_amount' });
      const { rows } = await pool.query(`UPDATE kid_money_goals SET saved_pence=GREATEST(0, saved_pence-$3), achieved_at=NULL
        WHERE id=$1 AND child_id=$2 AND active
          AND NOT EXISTS (SELECT 1 FROM kid_money_payout_requests WHERE goal_id=$1 AND status='pending')
        RETURNING id, saved_pence, target_pence`, [req.params.id, req.kid.id, pence]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, goal: rows[0], ...(await summary(pool, req.kid.id)) });
    });

    // "I saved enough — can I buy it?" → a parent decides; nothing is spent until they approve.
    r.post('/money/goals/:id/spend-request', async (req, res) => {
      const kid = req.kid;
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      try {
        const out = await tx(pool, async (c) => {
          await lockMoney(c, kid.id);
          const { rows: [g] } = await c.query('SELECT id, title, saved_pence FROM kid_money_goals WHERE id=$1 AND child_id=$2 AND active', [req.params.id, kid.id]);
          if (!g) return { status: 404, body: { ok: false, error: 'not_found' } };
          if (g.saved_pence <= 0) return { status: 409, body: { ok: false, error: 'nothing_saved' } };
          const { rows: pend } = await c.query(`SELECT 1 FROM kid_money_payout_requests WHERE goal_id=$1 AND status='pending' LIMIT 1`, [g.id]);
          if (pend.length) return { status: 409, body: { ok: false, error: 'already_pending' } };
          const { rows: [ins] } = await c.query(`INSERT INTO kid_money_payout_requests(child_id, goal_id, amount_pence, note, status)
            VALUES ($1,$2,$3,$4,'pending') RETURNING id, amount_pence, status, requested_at`, [kid.id, g.id, g.saved_pence, g.title]);
          return { status: 200, body: { ok: true, request: ins }, goal: g };
        });
        if (out.goal) util.audit(req.uid, 'money_spend_request', { child: kid.id, goal: out.goal.title, pence: out.goal.saved_pence });
        res.status(out.status).json(out.body);
      } catch (e) { err(res, e, 'spend-request'); }
    });

    // ---- Parent ----
    r.get('/money/parent', parentOnly, async (req, res) => {
      try { res.json(await parentSummary(pool, req.kid.id)); } catch (e) { err(res, e, 'parent'); }
    });

    // Weekly pocket money. Pass a stable `ref` (e.g. the ISO week) so it can't be paid twice.
    r.post('/money/allowance', parentOnly, async (req, res) => {
      try {
        const out = await payAllowance(pool, req.kid.id, req.body, req.uid);
        if (out.body.credited) util.audit(req.uid, 'money_allowance', { child: req.kid.id, pence: out.body.credited, ref: (req.body || {}).ref || null });
        res.status(out.status).json(out.body);
      } catch (e) { err(res, e, 'allowance'); }
    });

    r.post('/money/settings', parentOnly, async (req, res) => {
      const p = parseInt((req.body || {}).allowance_pence, 10);
      if (!Number.isFinite(p) || p < 0 || p > 100000) return res.status(400).json({ ok: false, error: 'bad_amount' });
      await pool.query(`INSERT INTO kid_money_settings(child_id, allowance_pence) VALUES ($1,$2)
        ON CONFLICT (child_id) DO UPDATE SET allowance_pence=EXCLUDED.allowance_pence, updated_at=NOW()`, [req.kid.id, p]);
      res.json({ ok: true, allowance_pence: p });
    });

    // Manual +/- correction.
    r.post('/money/adjust', parentOnly, async (req, res) => {
      const pence = parseInt((req.body || {}).pence, 10);
      if (!Number.isFinite(pence) || pence === 0 || Math.abs(pence) > MAX) return res.status(400).json({ ok: false, error: 'bad_amount' });
      const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, 200) : 'Adjustment';
      try {
        const r2 = await tx(pool, (c) => creditIn(c, req.kid.id, { pence, source: 'adjust', note, by: req.uid }));
        util.audit(req.uid, 'money_adjust', { child: req.kid.id, pence });
        res.json({ ok: true, balance: r2.balance });
      } catch (e) { err(res, e, 'adjust'); }
    });

    // approve → the money is spent (negative ledger row) and the pot's earmark released; decline → nothing changes.
    r.post('/money/payouts/:id/decide', parentOnly, async (req, res) => {
      const b = req.body || {};
      if (!['approved', 'declined'].includes(b.decision)) return res.status(400).json({ ok: false, error: 'bad_decision' });
      if (!isUuid(req.params.id)) return res.status(404).json({ ok: false, error: 'not_found' });
      const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 200) : null;
      const who = await parentName(pool, req.uid);
      const kid = req.kid;
      try {
        const out = await tx(pool, async (c) => {
          await lockMoney(c, kid.id);
          const { rows: [rq] } = await c.query('SELECT id, goal_id, amount_pence, status FROM kid_money_payout_requests WHERE id=$1 AND child_id=$2 FOR UPDATE', [req.params.id, kid.id]);
          if (!rq) return { status: 404, body: { ok: false, error: 'not_found' } };
          if (rq.status !== 'pending') return { status: 409, body: { ok: false, error: 'already_decided' } };
          if (b.decision === 'approved') {
            let title = 'pocket money';
            if (rq.goal_id) {
              const { rows: [g] } = await c.query('SELECT title FROM kid_money_goals WHERE id=$1', [rq.goal_id]);
              if (g) title = g.title;
              await c.query('UPDATE kid_money_goals SET saved_pence=GREATEST(0, saved_pence-$2) WHERE id=$1', [rq.goal_id, rq.amount_pence]);
            }
            await creditIn(c, kid.id, { pence: -Math.abs(rq.amount_pence), source: 'payout', ref: rq.id, note: `Spent on: ${title}`, by: req.uid });
            await c.query(`UPDATE kid_money_payout_requests SET status='paid', decided_at=NOW(), parent_note=$2, parent_user=$3, decided_by=$4 WHERE id=$1`, [rq.id, note, who, req.uid]);
          } else {
            await c.query(`UPDATE kid_money_payout_requests SET status='declined', decided_at=NOW(), parent_note=$2, parent_user=$3, decided_by=$4 WHERE id=$1`, [rq.id, note, who, req.uid]);
          }
          return { status: 200, body: { ok: true, decision: b.decision } };
        });
        if (out.status === 200) {
          Object.assign(out.body, await summary(pool, kid.id));
          util.audit(req.uid, 'money_payout_decide', { child: kid.id, request: req.params.id, decision: b.decision });
        }
        res.status(out.status).json(out.body);
      } catch (e) { err(res, e, 'payout-decide'); }
    });
  },

  // Server-to-server (same paths + JSON as the old family app's /api/parent/money/*).
  hooks(r, { pool }) {
    const childOnly = (req, res, next) => (req.hookUser.role === 'child' ? next() : res.status(404).json({ ok: false, error: 'not a child' }));
    r.post('/api/parent/money/allowance', childOnly, async (req, res) => {
      try { const out = await payAllowance(pool, req.hookUser.id, req.body, null); res.status(out.status).json(out.body); }
      catch (e) { console.error('[hooks/money/allowance]', e.message); res.status(500).json({ ok: false, error: 'internal' }); }
    });
    r.get('/api/parent/money/summary', childOnly, async (req, res) => {
      const s = await parentSummary(pool, req.hookUser.id);
      res.json({ ok: true, total: s.total, earmarked: s.earmarked, spendable: s.spendable, goals: s.goals, payouts: s.payouts, ledger: s.ledger });
    });
  },
};
