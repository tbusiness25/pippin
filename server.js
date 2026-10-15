require('./src/env');   // .env + AI_PROVIDER presets — must load first
const express = require('express');
require('./src/asyncErrors');   // async route errors → 500, never a crash
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { initDb, pool } = require('./src/db');
const { requireAuth } = require('./src/auth');
const household = require('./src/household');
const { createBrains } = require('./src/brains');

const PORT = parseInt(process.env.PORT || '8080', 10);
const APP_VERSION = process.env.APP_VERSION || require('./package.json').version;
const SW_VERSION = process.env.SW_VERSION || 'dev';
const { APP_NAME } = require('./src/brand');
const brand = (t) => t.replace(/__SW_VERSION__/g, SW_VERSION).replace(/__APP_NAME__/g, APP_NAME);
const PUBLIC = path.join(__dirname, 'public');
// Optional extra tiles on Explore: EXPLORE_LINKS=[{"emoji":"🏊","name":"Wild swimming","sub":"Water quality","url":"https://…"}]
const EXPLORE_LINKS = (() => {
  try { return (JSON.parse(process.env.EXPLORE_LINKS || '[]') || []).filter((l) => l && /^https?:\/\//.test(l.url) && l.name).slice(0, 12)
    .map((l) => ({ emoji: String(l.emoji || '🔗').slice(0, 8), name: String(l.name).slice(0, 40), sub: String(l.sub || '').slice(0, 60), url: String(l.url) })); }
  catch (e) { console.warn('[config] EXPLORE_LINKS is not valid JSON — ignored'); return []; }
})();

// Optional parts of the app the frontend should only offer when the server has them.
const FEATURES = {
  fitness: !!process.env.SPARKY_URL || /(^|,)fitness(,|$)/.test(process.env.COMPOSE_PROFILES || ''),
  reads: (() => { try { return fs.readdirSync(process.env.READS_DIR || '/data/reads').some((f) => f.endsWith('.md')); } catch { return false; } })(),
};
const brains = createBrains(process.env);
console.log(`[brain] default: ${brains.default.name} — ${brains.default.label}; agent profiles: ${brains.profiles.join(', ') || 'none'}`);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()' });
  next();
});
// Optional username + password for the whole site (BASIC_AUTH_USER / BASIC_AUTH_PASS) — e.g. a demo shared with friends.
// The health check and server-to-server routes (/hooks, /internal) stay open.
if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS) {
  const crypto = require('crypto');
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  app.use((req, res, next) => {
    if (req.path === '/api/health' || req.path.startsWith('/hooks/') || req.path.startsWith('/internal/')) return next();
    const [type, token] = String(req.headers.authorization || '').split(' ');
    if (type === 'Basic' && token) {
      const [u, ...rest] = Buffer.from(token, 'base64').toString().split(':');
      if (same(u, process.env.BASIC_AUTH_USER) && same(rest.join(':'), process.env.BASIC_AUTH_PASS)) return next();
    }
    res.set('WWW-Authenticate', `Basic realm="${APP_NAME}", charset="UTF-8"`).status(401).send('Username and password needed');
  });
}
const demo = require('./src/demo');
const kids = require('./src/kids');
kids.mount(app, { brains, phase: 'early' });      // /hooks/:slug — integration endpoints (token, never proxied)
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', demo.autoLogin);   // DEMO_MODE only: visitors are signed in as the demo person
demo.mount(app);

app.get('/sw.js', (req, res) => {
  const sw = brand(fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8'));
  res.type('application/javascript').setHeader('Cache-Control', 'no-cache').send(sw);
});
app.get('/js/build-info.js', (req, res) => {
  res.type('application/javascript').setHeader('Cache-Control', 'no-cache')
    .send(`window.__BUILD__=${JSON.stringify({ version: APP_VERSION, sw: SW_VERSION, appName: APP_NAME, links: EXPLORE_LINKS, demo: demo.on(), features: FEATURES })};window.APP=window.__BUILD__.appName;`);
});
app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, version: APP_VERSION, brain: brains.default.name }); }
  catch (e) { res.status(503).json({ ok: false }); }
});

// Sidecar → app only, never via the public proxy (reject anything that came through Cloudflare/nginx).
app.use('/internal', (req, res, next) => (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] ? res.status(404).end() : next()),
  require('./src/routes/people').internal);
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api', requireAuth, household.loadRole, household.childGate);
// Offline outbox replays carry X-Op-Id; a replayed write is acknowledged once and never applied twice.
app.use('/api', async (req, res, next) => {
  const op = req.headers['x-op-id'];
  if (!op || req.method === 'GET' || !/^[\w-]{8,64}$/.test(op)) return next();
  const { rowCount } = await pool.query('INSERT INTO client_ops(user_id, op_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.uid, op]);
  if (!rowCount) return res.json({ ok: true, duplicate: true });
  next();
});
app.use('/api/pet', require('./src/routes/pet')(brains));
app.use('/api/village', require('./src/routes/village'));
app.use('/api/goals', require('./src/routes/goals'));
app.use('/api/checkins', require('./src/routes/checkins'));
app.use('/api/streak', require('./src/routes/streak'));
app.use('/api/coach', require('./src/routes/coach')(brains));
app.use('/api/shop', require('./src/routes/shop'));
app.use('/api/tools', require('./src/routes/tools'));
app.use('/api/social', require('./src/routes/social'));
app.use('/api/push', require('./src/routes/push'));
app.use('/api/plans', require('./src/routes/plans'));
app.use('/api/people', require('./src/routes/people'));
app.use('/api/privacy', require('./src/routes/privacy'));
app.use('/api/habits', require('./src/routes/habits'));
app.use('/api/sober', require('./src/routes/sober'));
app.use('/api/report', require('./src/routes/report'));
app.use('/api/chat', require('./src/routes/chat'));
app.use('/api/voice', require('./src/routes/voice'));
app.use('/api/fitness', require('./src/routes/fitness'));
app.use('/api/reads', require('./src/routes/reads'));
app.use('/api/breathwork', require('./src/routes/breathwork'));
app.use('/api/agent', require('./src/routes/agent')(brains));
kids.mount(app, { brains, phase: 'late' });       // /api/kids, /api/family

// HTML is never cached; versioned assets can be.
// Feature modules (kids, family) are plain files in public/js/{kids,family} and public/css/kids — listed here
// so adding one needs no edit to index.html.
function moduleTags() {
  const list = (dir, ext) => { try { return fs.readdirSync(path.join(PUBLIC, dir)).filter((f) => f.endsWith(ext)).sort(); } catch { return []; } };
  return [...list('css/kids', '.css').map((f) => `<link rel="stylesheet" href="/css/kids/${f}?v=${SW_VERSION}">`),
    ...list('js/kids', '.js').map((f) => `<script src="/js/kids/${f}?v=${SW_VERSION}"></script>`),
    ...list('js/family', '.js').map((f) => `<script src="/js/family/${f}?v=${SW_VERSION}"></script>`)].join('\n  ');
}

// Each host can be its own installable app ("Sam's Pippin") — see HOST_USERS in .env.
app.get('/manifest.json', async (req, res, next) => {
  try {
    const b = await household.brandFor(req);
    const m = JSON.parse(brand(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8')));
    if (b.personal) {
      m.name = b.name; m.short_name = b.shortName;
      m.id = `/?who=${encodeURIComponent(b.userId)}`;
      if (b.colour) m.theme_color = b.colour;
    }
    res.type('application/manifest+json').set('Cache-Control', 'no-cache').send(JSON.stringify(m, null, 2));
  } catch (e) { next(e); }
});
app.use(express.static(PUBLIC, {
  index: false,
  setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store'); },
}));
app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false });
  try {
    const b = await household.brandFor(req);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    let html = brand(fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')).replace(/<script src="\/js\/modules\.js[^"]*"><\/script>/, moduleTags()).replace(/<title>[^<]*<\/title>/, `<title>${b.name.replace(/[<>&]/g, '')}</title>`);
    if (b.colour) html = html.replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${b.colour}">`);
    res.send(html);
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.path, err.message);
  res.status(500).json({ ok: false, error: 'Something went wrong' });
});

initDb()
  .then(() => require('./src/push').init())
  .then(() => {
    require('./src/coach/crypto').check();          // fail fast if FINCH_DATA_KEY is missing
    const engine = require('./src/coach/engine');
    engine.purge().catch(() => {});
    setInterval(() => engine.purge().catch(() => {}), 6 * 3600 * 1000);
    require('./src/voice/ingest').start();
    require('./src/agentChecks').start(brains);
    kids.startAll();
  })
  .then(() => app.listen(PORT, () => { console.log(`[pippin] ${APP_VERSION} listening on :${PORT}`); demo.start(); }))
  .catch((e) => { console.error('[fatal]', e); process.exit(1); });
