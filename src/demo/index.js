/*
 * Demo mode (DEMO_MODE=true): a public "try it" server full of made-up data.
 *  - Visitors are signed in automatically as the first DEMO_USERS person (default "sam") — no PIN screen.
 *  - A banner (public/js/family/zz-demo.js) lets them switch to the partner or the child, and says it's shared.
 *  - Everything is wiped and re-seeded from src/demo/seed.js every night (DEMO_RESET_HOUR, default 4) and on
 *    first start, so whatever visitors type disappears.
 * NEVER set DEMO_MODE on a real server: the reset truncates every user table.
 */
const { signSession, setSessionCookie, readSession } = require('../auth');
const { pool } = require('../db');

const on = () => process.env.DEMO_MODE === 'true';
const users = () => (process.env.DEMO_USERS || 'sam,alex,pip').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const COOKIE = 'finch_session';

async function idFor(slug) {
  const { rows: [u] } = await pool.query('SELECT id FROM users WHERE lower(slug)=$1 AND deleted_at IS NULL', [slug]);
  return u && u.id;
}

// Hosts where every visitor gets their OWN throwaway account (e.g. a demo where people type their
// own postcodes): DEMO_GUEST_HOSTS=guests.example.com=#home,…  (host=landing page)
const guestHosts = () => Object.fromEntries((process.env.DEMO_GUEST_HOSTS || '').split(',').map((x) => x.trim()).filter(Boolean)
  .map((x) => { const [h, hash] = x.split('='); return [h.toLowerCase(), hash || '#home']; }));
const isGuestHost = (req) => Object.prototype.hasOwnProperty.call(guestHosts(), String(req.hostname || '').toLowerCase());
const guestsByIp = new Map();   // ip → [timestamps]

async function newGuest(req) {
  const ip = req.ip || 'x'; const now = Date.now();
  const recent = (guestsByIp.get(ip) || []).filter((t) => now - t < 3600 * 1000);
  if (recent.length >= 20) throw new Error('Too many new demo visits from here — try again later');
  guestsByIp.set(ip, [...recent, now]);
  const slug = `guest-${require('crypto').randomBytes(4).toString('hex')}`;
  const { rows: [u] } = await pool.query(`INSERT INTO users(name, pin_hash, tz, settings, role, is_parent, slug) VALUES ('Guest','!demo-guest','Europe/London',$1,'adult',false,$2) RETURNING id`,
    [JSON.stringify({ nudges: false, demo_guest: true }), slug]);
  await pool.query(`INSERT INTO pets(user_id, name, pronouns, colour, traits) VALUES ($1,'Pebble','they/them','sky',$2)`, [u.id, ['curious']]);
  return u.id;
}

/** Before auth: sign the visitor in — as the shared demo person, or (on guest hosts) as their own guest. */
function autoLogin(req, res, next) {
  if (!on()) return next();
  const sess = readSession(req);
  const sign = (id) => { const t = signSession(id); setSessionCookie(req, res, t); req.cookies = { ...(req.cookies || {}), [COOKIE]: t }; };
  (async () => {
    if (isGuestHost(req)) {
      if (sess && sess.uid) {
        const { rows: [u] } = await pool.query(`SELECT slug FROM users WHERE id=$1 AND deleted_at IS NULL`, [sess.uid]);
        if (u && String(u.slug).startsWith('guest-')) return;
      }
      // only the app's first call makes a guest — parallel requests on the first page load would each make one
      if (req.path === '/auth/status') sign(await newGuest(req));
      return;
    }
    if (sess && sess.uid) return;
    const id = await idFor(users()[0]); if (id) sign(id);
  })().then(() => next(), (e) => res.status(429).json({ ok: false, error: e.message }));
}

function mount(app) {
  if (!on()) return;
  app.get('/api/demo', async (req, res) => {
    if (isGuestHost(req)) return res.json({ ok: true, guest: true, landing: guestHosts()[String(req.hostname).toLowerCase()] });
    const { rows } = await pool.query(`SELECT name, slug, role FROM users WHERE deleted_at IS NULL AND lower(slug) = ANY($1) ORDER BY array_position($1, lower(slug))`, [users()]);
    const sess = readSession(req);
    const { rows: [me] } = sess ? await pool.query('SELECT slug FROM users WHERE id=$1', [sess.uid]).catch(() => ({ rows: [] })) : { rows: [] };
    res.json({ ok: true, people: rows, me: me && me.slug, resetHour: parseInt(process.env.DEMO_RESET_HOUR || '4', 10) });
  });
  app.post('/api/demo/as/:slug', async (req, res) => {
    const slug = String(req.params.slug).toLowerCase();
    if (!users().includes(slug)) return res.status(404).json({ ok: false });
    const id = await idFor(slug);
    if (!id) return res.status(404).json({ ok: false });
    setSessionCookie(req, res, signSession(id));
    res.json({ ok: true });
  });
}

let resetting = false;
async function reset(reason) {
  if (!on() || resetting) return;
  resetting = true;
  try {
    console.log(`[demo] resetting (${reason})…`);
    await require('./seed').run(pool);
    console.log('[demo] fresh demo data ready');
  } catch (e) { console.error('[demo] reset failed:', e); } finally { resetting = false; }
}

function start() {
  if (!on()) return;
  const hour = parseInt(process.env.DEMO_RESET_HOUR || '4', 10);
  let last = null;
  pool.query('SELECT count(*)::int n FROM users').then(({ rows: [r] }) => { if (!r.n) reset('first start'); }).catch(() => {});
  setInterval(() => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const today = `${p.year}-${p.month}-${p.day}`;
    if (parseInt(p.hour, 10) % 24 === hour && last !== today) { last = today; reset('nightly'); }
  }, 5 * 60 * 1000);
  console.log(`[demo] DEMO MODE — auto sign-in as ${users()[0]}, nightly reset at ${hour}:00`);
}

module.exports = { on, autoLogin, mount, start, reset, guestHosts };
