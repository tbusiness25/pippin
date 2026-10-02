require('./src/env');   // .env + AI_PROVIDER presets — must load first
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { initDb, pool } = require('./src/db');
const { requireAuth } = require('./src/auth');
const { createBrain } = require('./src/brains');

const PORT = parseInt(process.env.PORT || '8080', 10);
const APP_VERSION = process.env.APP_VERSION || require('./package.json').version;
const SW_VERSION = process.env.SW_VERSION || 'dev';
const { APP_NAME } = require('./src/brand');
const brand = (t) => t.replace(/__SW_VERSION__/g, SW_VERSION).replace(/__APP_NAME__/g, APP_NAME);
const PUBLIC = path.join(__dirname, 'public');

const brain = createBrain(process.env);
console.log(`[brain] ${brain.name} — ${brain.label}`);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()' });
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/sw.js', (req, res) => {
  const sw = brand(fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8'));
  res.type('application/javascript').setHeader('Cache-Control', 'no-cache').send(sw);
});
app.get('/js/build-info.js', (req, res) => {
  res.type('application/javascript').setHeader('Cache-Control', 'no-cache')
    .send(`window.__BUILD__=${JSON.stringify({ version: APP_VERSION, sw: SW_VERSION, appName: APP_NAME })};window.APP=window.__BUILD__.appName;`);
});
app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, version: APP_VERSION, brain: brain.name }); }
  catch (e) { res.status(503).json({ ok: false }); }
});

// Sidecar → app only, never via the public proxy (reject anything that came through Cloudflare/nginx).
app.use('/internal', (req, res, next) => (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] ? res.status(404).end() : next()),
  require('./src/routes/people').internal);
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api', requireAuth);
// Offline outbox replays carry X-Op-Id; a replayed write is acknowledged once and never applied twice.
app.use('/api', async (req, res, next) => {
  const op = req.headers['x-op-id'];
  if (!op || req.method === 'GET' || !/^[\w-]{8,64}$/.test(op)) return next();
  const { rowCount } = await pool.query('INSERT INTO client_ops(user_id, op_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.uid, op]);
  if (!rowCount) return res.json({ ok: true, duplicate: true });
  next();
});
app.use('/api/pet', require('./src/routes/pet')(brain));
app.use('/api/goals', require('./src/routes/goals'));
app.use('/api/checkins', require('./src/routes/checkins'));
app.use('/api/streak', require('./src/routes/streak'));
app.use('/api/coach', require('./src/routes/coach')(brain));
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

// HTML is never cached; versioned assets can be.
app.get('/manifest.json', (req, res) => res.type('application/manifest+json').set('Cache-Control', 'no-cache')
  .send(brand(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8'))));
app.use(express.static(PUBLIC, {
  index: false,
  setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store'); },
}));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false });
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(brand(fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')));
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
  })
  .then(() => app.listen(PORT, () => console.log(`[pippin] ${APP_VERSION} listening on :${PORT}`)))
  .catch((e) => { console.error('[fatal]', e); process.exit(1); });
