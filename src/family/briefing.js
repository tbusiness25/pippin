/*
 * The morning briefing: once a day (BRIEF_HOUR, default 7, in the person's time zone) a short, warm
 * note made from today's weather, the household calendar, the person's own open plans and to-dos. Sent as a web
 * push (only if
 * the person has nudges on) and kept on Explore → Briefing.
 *
 * Opt-in per adult: BRIEFING_FOR=<slug>,<slug> (or * for every adult).
 * Model: any OpenAI-compatible endpoint — BRIEF_BASE_URL + BRIEF_MODEL (+ BRIEF_API_KEY,
 * BRIEF_REASONING_EFFORT). Falls back to STORY_BASE_URL / STORY_MODEL. The prompt contains the person's
 * to-dos, so prefer a model you run yourself.
 * Weather: BRIEF_LAT + BRIEF_LON (open-meteo.com, no key). Leave unset for no weather.
 */
const calendar = require('./calendar');

const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const env = (k, d = '') => process.env[k] || d;
const HOUR = parseInt(env('BRIEF_HOUR', '7'), 10);
const forList = () => env('BRIEFING_FOR').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isOn = (u) => !!u && u.role === 'adult' && (forList().includes('*') || forList().includes(String(u.slug || '').toLowerCase()));

const WMO = { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle',
  53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow',
  75: 'heavy snow', 80: 'showers', 81: 'showers', 82: 'heavy showers', 95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm' };

const localDate = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
const localHour = (tz) => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()), 10) % 24;
const weekday = (tz) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(new Date()));

async function weather(tz) {
  const lat = env('BRIEF_LAT'), lon = env('BRIEF_LON');
  if (!lat || !lon) return null;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`
      + `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(tz)}&forecast_days=1`,
    { signal: AbortSignal.timeout(15000) });
    const d = await r.json();
    if (!d.daily) return null;
    return { now: Math.round(d.current?.temperature_2m), code: WMO[d.current?.weather_code] || 'mixed',
      max: Math.round(d.daily.temperature_2m_max?.[0]), min: Math.round(d.daily.temperature_2m_min?.[0]), rain: d.daily.precipitation_probability_max?.[0] };
  } catch { return null; }
}

async function gather(pool, u) {
  const today = localDate(u.tz);
  const q = (sql, p) => pool.query(sql, p).then((r) => r.rows).catch(() => []);
  const [w, cal, inbox, plans, goals, news] = await Promise.all([
    weather(u.tz),
    calendar.between(pool, today, today).catch(() => []),
    q(`SELECT text, due_on FROM inbox_items WHERE user_id=$1 AND status='open' AND (due_on IS NULL OR due_on <= $2)
        ORDER BY due_on NULLS LAST, created_at DESC LIMIT 12`, [u.id, today]),
    q(`SELECT what, when_text, due_at FROM commitments WHERE user_id=$1 AND status='open'
        AND (due_at IS NULL OR (due_at AT TIME ZONE $3)::date <= $2::date) ORDER BY due_at NULLS LAST, created_at LIMIT 8`, [u.id, today, u.tz]),
    q(`SELECT g.title FROM goals g LEFT JOIN goal_completions c ON c.goal_id=g.id AND c.day=$2 AND NOT c.undone
        WHERE g.user_id=$1 AND g.deleted_at IS NULL AND c.id IS NULL AND ((g.once_on IS NULL AND $3 = ANY(g.days)) OR g.once_on = $2)
        ORDER BY g.sort, g.created_at LIMIT 10`, [u.id, today, weekday(u.tz)]),
    [],
  ]);
  return { today, weather: w, cal, inbox, plans, goals, news };
}

function prompt(u, g) {
  const first = String(u.name || '').trim().split(/\s+/)[0] || 'them';
  let ctx = `Date: ${g.today}\n`;
  if (g.weather) ctx += `Weather: now ${g.weather.now}°C ${g.weather.code}, high ${g.weather.max}° low ${g.weather.min}°, rain chance ${g.weather.rain}%.\n`;
  ctx += `\nToday on the family calendar:\n${g.cal.length ? g.cal.map((e) => `- ${e.start_time ? `${e.start_time} ` : ''}${e.title}${e.notes ? ` (${e.notes})` : ''}`).join('\n') : '- Nothing scheduled.'}\n`;
  ctx += `\nThings ${first} planned for today:\n${[...g.goals.map((x) => `- ${x.title}`), ...g.plans.map((p) => `- ${p.what}${p.when_text ? ` (${p.when_text})` : ''}`)].join('\n') || '- None.'}\n`;
  ctx += `\nOpen to-dos:\n${g.inbox.length ? g.inbox.map((t) => `- ${t.text}${t.due_on ? ` (due ${t.due_on})` : ''}`).join('\n') : '- None.'}\n`;
  return `You are ${first}'s calm morning briefer. Using ONLY the facts below, write a warm, concise morning briefing in Markdown (about 150–250 words). `
    + 'Open with a one-line greeting' + (g.weather ? ' and the weather' : '') + '. Then a short "Today" section: the calendar and their plans, '
    + 'plus a gentle mention of anything pressing from the to-dos — no nagging, no guilt, no streaks. '
    + (g.news.length ? 'Then a "Worth a look" section: pick 3–4 of the reading items with a one-line why-it-is-interesting each. ' : '')
    + 'Keep it human and encouraging. Do NOT invent anything that is not in the facts.\n\n=== FACTS ===\n' + ctx;
}

async function llm(text) {
  const base = env('BRIEF_BASE_URL', env('STORY_BASE_URL')).replace(/\/$/, '');
  const model = env('BRIEF_MODEL', env('STORY_MODEL'));
  if (!base || !model) throw new Error('BRIEF_BASE_URL / BRIEF_MODEL not configured');
  const effort = env('BRIEF_REASONING_EFFORT', env('STORY_REASONING_EFFORT'));
  const key = env('BRIEF_API_KEY');
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, stream: false, max_tokens: 900, temperature: 0.6, messages: [{ role: 'user', content: text }],
      ...(effort ? { reasoning_effort: effort } : {}) }),
    signal: AbortSignal.timeout(parseInt(env('BRIEF_TIMEOUT_MS', '240000'), 10)),
  });
  if (!r.ok) throw new Error(`briefing model HTTP ${r.status}`);
  const d = await r.json();
  return String(d.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

const inFlight = new Set();
const failedAt = new Map();   // after a failure, wait 30 min before the scheduler tries again
async function generate(pool, u, { force = false, notify = true } = {}) {
  if (inFlight.has(u.id)) return { busy: true };
  inFlight.add(u.id);
  try {
    const today = localDate(u.tz);
    if (!force) {
      const { rows } = await pool.query('SELECT 1 FROM family_briefings WHERE user_id=$1 AND brief_date=$2', [u.id, today]);
      if (rows.length) return { skipped: true };
    }
    const g = await gather(pool, u);
    const content = await llm(prompt(u, g));
    if (!content) throw new Error('empty briefing');
    await pool.query(`INSERT INTO family_briefings(user_id, brief_date, content, data) VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id, brief_date) DO UPDATE SET content=EXCLUDED.content, data=EXCLUDED.data, created_at=NOW()`,
    [u.id, g.today, content, { weather: g.weather, cal: g.cal.length, todos: g.inbox.length, plans: g.plans.length + g.goals.length, news: g.news.length }]);
    if (notify && (u.settings || {}).fam_briefing_push !== false) {
      const line = content.split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').replace(/\*\*/g, '').trim()).find(Boolean) || 'Your morning briefing is ready.';
      require('../push').notify(u.id, 'briefing', line.slice(0, 180), { ref: g.today, title: '☀️ Morning briefing', url: '/#briefing' }).catch(() => {});
    }
    console.log(`[briefing] ${u.slug || u.id} ${g.today} (cal=${g.cal.length} todos=${g.inbox.length} plans=${g.plans.length + g.goals.length} news=${g.news.length})`);
    return { ok: true, content };
  } finally { inFlight.delete(u.id); }
}

async function people(pool) {
  const { rows } = await pool.query(`SELECT id, name, slug, role, tz, settings FROM users WHERE role='adult' AND deleted_at IS NULL`);
  return rows.filter(isOn);
}

module.exports = {
  isOn, generate,
  family(r, { pool }) {
    const gate = a(async (req, res, next) => {
      const { rows: [u] } = await pool.query('SELECT id, name, slug, role, tz, settings FROM users WHERE id=$1 AND deleted_at IS NULL', [req.uid]);
      if (!isOn(u)) return res.status(404).json({ ok: false, error: 'The briefing isn’t switched on for you' });
      req.me = u; next();
    });
    r.get('/briefing/today', gate, a(async (req, res) => {
      const { rows } = await pool.query(`SELECT brief_date, content, data, created_at FROM family_briefings WHERE user_id=$1
        ORDER BY brief_date DESC LIMIT 1`, [req.uid]);
      res.json({ ok: true, today: localDate(req.me.tz), briefing: rows[0] || null, hour: HOUR, push: (req.me.settings || {}).fam_briefing_push !== false });
    }));
    r.get('/briefing/recent', gate, a(async (req, res) => {
      const { rows } = await pool.query(`SELECT brief_date, content, created_at FROM family_briefings WHERE user_id=$1
        ORDER BY brief_date DESC LIMIT 30`, [req.uid]);
      res.json({ ok: true, briefings: rows });
    }));
    // Make (or remake) today's now. Slow: the model writes it while the person waits.
    r.post('/briefing/generate', gate, a(async (req, res) => {
      try {
        const out = await generate(pool, req.me, { force: true, notify: false });
        if (out.busy) return res.status(409).json({ ok: false, error: 'Already writing it — give it a minute' });
        res.json({ ok: true, content: out.content });
      } catch (e) { console.warn('[briefing]', e.message); res.status(502).json({ ok: false, error: 'Couldn’t write it just now — try again later' }); }
    }));
    r.post('/briefing/settings', gate, a(async (req, res) => {
      const push = !!(req.body || {}).push;
      await pool.query(`UPDATE users SET settings = settings || jsonb_build_object('fam_briefing_push', $2::boolean) WHERE id=$1`, [req.uid, push]);
      res.json({ ok: true, push });
    }));
  },

  // POST /hooks/<slug>/api/briefing/generate[?notify=0] — make today's on demand (testing, or an external scheduler).
  hooks(r, { pool }) {
    r.post('/api/briefing/generate', a(async (req, res) => {
      const u = req.hookUser;
      if (!isOn(u)) return res.status(404).json({ ok: false, error: 'briefing not switched on for this person' });
      try { res.json({ ok: true, result: await generate(pool, u, { force: true, notify: req.query.notify !== '0' }) }); }
      catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    }));
  },

  start({ pool }) {
    // Keep users.settings.fam_briefing in step with BRIEFING_FOR so the app knows whether to show the tile.
    pool.query(`SELECT id, slug, role FROM users WHERE deleted_at IS NULL`)
      .then(({ rows }) => Promise.all(rows.map((u) => pool.query(
        `UPDATE users SET settings = settings || jsonb_build_object('fam_briefing', $2::boolean) WHERE id=$1`, [u.id, isOn(u)]))))
      .catch((e) => console.warn('[briefing] flags', e.message));
    const check = async () => {
      for (const u of await people(pool)) {
        const h = localHour(u.tz);
        if (h < HOUR || h >= HOUR + 3 || Date.now() - (failedAt.get(u.id) || 0) < 30 * 60 * 1000) continue;
        await generate(pool, u).catch((e) => { failedAt.set(u.id, Date.now()); console.warn('[briefing]', u.slug || u.id, e.message); });
      }
    };
    setInterval(() => check().catch((e) => console.warn('[briefing]', e.message)), 5 * 60 * 1000);
    console.log(`[briefing] scheduler on (~${HOUR}:00 local; for: ${forList().join(', ') || 'nobody'})`);
  },
};
