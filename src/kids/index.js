/*
 * Kids & Family: children's accounts and the parents' Family section.
 *
 *   /api/kids/*    — a child's own features (chores, books, stories…). A child uses them for themself;
 *                    a parent can use the same endpoints for a child by adding ?child=<id> (or X-Child header)
 *                    and then also gets the parent-only actions (approve, edit, money…).  req.kid = the child,
 *                    req.asParent = true when a parent is acting.
 *   /api/family/*  — adults: course, shared calendar, list of children, briefings… (src/family/*).
 *   /hooks/:slug/* — server-to-server integration (n8n, story workers) with HOOKS_TOKEN. Never via a proxy.
 *
 * Every module is a file exporting any of:
 *   routes(kidsRouter, deps)    — child/parent endpoints, mounted under /api/kids
 *   family(familyRouter, deps)  — adult endpoints under /api/family
 *   hooks(hooksRouter, deps)    — integration endpoints under /hooks/:slug (req.hookUser = that person)
 *   rawHooks(hooksRouter, deps) — same, but mounted BEFORE the JSON parser (big uploads bring their own)
 *   start(deps)                 — background jobs
 * A module that isn't present is simply skipped, so the app runs with any subset.
 */
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const game = require('../game');
const sprig = require('./sprig');
const util = require('./util');
const { requireParent } = require('../household');

const KID_MODULES = ['core', 'chores', 'care', 'stars', 'money', 'summer', 'books', 'stories', 'library', 'today', 'learn', 'collection', 'buddy', 'room', 'games', 'hopenotes', 'typing', 'village', 'responsibilities', 'yoto', 'monitor'];
const FAMILY_MODULES = ['children', 'calendar', 'briefing', 'digest', 'yoto'];

function load(dir, name) {
  try { return require(`../${dir}/${name}`); }
  catch (e) { if (e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(`${dir}/${name}`)) return null; throw e; }
}

/** Resolve which child a /api/kids request is about. */
async function resolveChild(req, res, next) {
  try {
    if (req.role === 'child') {
      const { rows: [kid] } = await pool.query('SELECT id, name, tz, settings, slug FROM users WHERE id=$1', [req.uid]);
      req.kid = kid; req.asParent = false; return next();
    }
    if (!(req.role === 'adult' && req.isParent)) return res.status(403).json({ ok: false, error: 'Only parents can open a child’s things' });
    const id = req.query.child || req.get('X-Child');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ ok: false, error: 'Which child? (child=…)' });
    const { rows: [kid] } = await pool.query(`SELECT id, name, tz, settings, slug FROM users WHERE id=$1 AND role='child' AND deleted_at IS NULL`, [id]);
    if (!kid) return res.status(404).json({ ok: false, error: 'No such child' });
    req.kid = kid; req.asParent = true; next();
  } catch (e) { next(e); }
}
const parentOnly = (req, res, next) => (req.asParent ? next() : res.status(403).json({ ok: false, error: 'Ask a grown-up' }));

const HOOKS_TOKEN = process.env.HOOKS_TOKEN || '';
function hookAuth(req, res, next) {
  if (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) return res.status(404).end();   // never via a proxy
  const t = req.get('X-Admin-Token') || req.get('X-Hooks-Token') || '';
  if (!HOOKS_TOKEN || t.length !== HOOKS_TOKEN.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(HOOKS_TOKEN))) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  pool.query(`SELECT id, name, role, tz, settings, slug FROM users WHERE lower(slug)=lower($1) AND deleted_at IS NULL`, [req.params.slug])
    .then(({ rows: [u] }) => { if (!u) return res.status(404).json({ ok: false, error: 'unknown person' }); req.hookUser = u; next(); })
    .catch(next);
}

const starters = [];
const installed = [];   // kid module ids actually present (filled by mount)
/** Background jobs — call once the database is ready. */
const startAll = () => starters.splice(0).forEach((f) => f());

/** Mount everything. `before` = called before the global JSON parser; `after` = after auth middleware. */
function mount(app, { brains, phase }) {
  const deps = { pool, game, sprig, util, brains, requireParent, parentOnly };
  const kidMods = KID_MODULES.map((n) => [n, load('kids', n)]).filter(([, m]) => m);
  installed.splice(0, installed.length, ...kidMods.map(([n]) => n).filter((n) => n !== 'core'));
  const famMods = FAMILY_MODULES.map((n) => [n, load('family', n)]).filter(([, m]) => m);
  const all = [...kidMods, ...famMods];

  if (phase === 'early') {
    // Integration hooks: raw ones first (own body parsers), then JSON ones.
    const hooks = express.Router({ mergeParams: true });
    for (const [, m] of all) if (m.rawHooks) m.rawHooks(hooks, deps);
    hooks.use(express.json({ limit: '2mb' }));
    for (const [, m] of all) if (m.hooks) m.hooks(hooks, deps);
    app.use('/hooks/:slug', hookAuth, hooks);
    return;
  }

  const kids = express.Router();
  kids.use(resolveChild, require('./access').gate);   // time-of-day rules for children (see access.js)
  for (const [, m] of kidMods) if (m.routes) m.routes(kids, deps);
  app.use('/api/kids', kids);

  const family = express.Router();
  family.use((req, res, next) => (req.role === 'adult' ? next() : res.status(404).json({ ok: false })));
  for (const [, m] of all) if (m.family) m.family(family, deps);
  app.use('/api/family', family);

  starters.push(...all.filter(([, m]) => m.start).map(([n, m]) => () => { try { m.start(deps); } catch (e) { console.error(`[kids] ${n} start failed:`, e.message); } }));
  console.log(`[kids] modules: ${kidMods.map(([n]) => n).join(', ') || 'none'} · family: ${famMods.map(([n]) => n).join(', ') || 'none'}`);
}

module.exports = { mount, startAll, installed, resolveChild, parentOnly, hookAuth, KID_MODULES, FAMILY_MODULES };
