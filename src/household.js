/*
 * Household: who is who on this server, and what each person may use.
 *
 * Roles
 *   adult  — the full app (coach, chat, habits…). `is_parent` adults also get the Family section.
 *   child  — the kids' experience only. Adult routes answer 404, so nothing leaks by accident.
 *
 * Host hints (optional, .env)
 *   HOST_USERS=app.example.org=alex:#6f9f5c,kid.example.org=sam:#ff8838
 *   Each host → a person's slug (or name) and an optional theme colour. Opening the app on that host
 *   preselects the person on the PIN screen and gives the install its own name ("Sam's Pippin").
 *   HOST_APP_NAME optionally names those per-person installs differently from APP_NAME.
 *   A host hint never signs anyone in by itself: the PIN is still checked, and only against that person.
 */
const { pool } = require('./db');
const { APP_NAME } = require('./brand');

function parseHostUsers(raw = process.env.HOST_USERS || '') {
  const map = new Map();
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^([^=\s]+)=([^:\s]+)(?::(#[0-9a-fA-F]{3,8}))?$/);
    if (!m) { console.warn(`[household] ignoring HOST_USERS entry "${part}"`); continue; }
    map.set(m[1].toLowerCase(), { who: m[2], colour: m[3] || null });
  }
  return map;
}
const HOSTS = parseHostUsers();

const hostOf = (req) => String(req.hostname || req.headers.host || '').toLowerCase().replace(/:\d+$/, '');

/** The person a request's host points at, or null. Looks up by slug first, then by name. */
async function hintedUser(req) {
  const h = HOSTS.get(hostOf(req));
  if (!h) return null;
  const { rows } = await pool.query(
    `SELECT id, name, role, slug, settings FROM users WHERE deleted_at IS NULL
       AND (lower(slug) = lower($1) OR lower(trim(name)) = lower($1)) ORDER BY (lower(slug) = lower($1)) DESC LIMIT 1`, [h.who]);
  return rows[0] ? { ...rows[0], colour: h.colour } : null;
}

/** Per-host install identity for the manifest / page title. */
async function brandFor(req) {
  const u = await hintedUser(req).catch(() => null);
  if (!u) return { name: APP_NAME, shortName: APP_NAME, colour: null, personal: false };
  const first = String(u.name).trim().split(/\s+/)[0];
  const possessive = /s$/i.test(first) ? `${first}’` : `${first}’s`;
  const app = (process.env.HOST_APP_NAME || APP_NAME).slice(0, 30);   // e.g. keep APP_NAME for the main host, a shared name per person
  return { name: `${possessive} ${app}`, shortName: `${possessive} ${app}`.slice(0, 24),
    colour: u.colour || (u.settings && u.settings.accent) || null, personal: true, userId: u.id };
}

async function getRole(uid) {
  const { rows } = await pool.query('SELECT role, is_parent, is_owner FROM users WHERE id=$1 AND deleted_at IS NULL', [uid]);
  return rows[0] || null;
}

/** Attach req.role / req.isParent / req.isOwner (after requireAuth). Signed-out-by-deletion → 401. */
async function loadRole(req, res, next) {
  try {
    const r = await getRole(req.uid);
    if (!r) return res.status(401).json({ ok: false, error: 'unauthorized' });
    req.role = r.role; req.isParent = r.is_parent; req.isOwner = r.is_owner;
    next();
  } catch (e) { next(e); }
}

// API areas a child may use. Everything else under /api answers 404 for a child account.
const CHILD_ALLOWED = [/^\/auth\//, /^\/pet(\/|$)/, /^\/shop(\/|$)/, /^\/kids(\/|$)/, /^\/push(\/|$)/,
  /^\/tools\/(content|session|daily)(\/|$)/, /^\/health$/];
function childGate(req, res, next) {
  if (req.role !== 'child') return next();
  if (CHILD_ALLOWED.some((re) => re.test(req.path))) return next();
  res.status(404).json({ ok: false });
}

function requireParent(req, res, next) {
  if (req.role === 'adult' && req.isParent) return next();
  res.status(403).json({ ok: false, error: 'Only parents can do that' });
}

module.exports = { parseHostUsers, hintedUser, brandFor, loadRole, childGate, requireParent, getRole, hostOf };
