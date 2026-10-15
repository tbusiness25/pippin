/*
 * The child's room — the few Home Assistant things they may switch themselves (a noise machine, a night light,
 * a sleep timer). SAFETY: this holds a Home Assistant token, so it is a CLOSED allowlist, not a bridge:
 * entity ids and services come only from the server-side config below, never from the request; an unknown
 * control is a 404.
 *
 * Config, keyed by child slug — KIDS_DATA_DIR/room.json, or the KIDS_ROOM_CONTROLS env var (same JSON):
 *   { "<slug>": {
 *       "controls": [ { "key": "night_light", "label": "Night light", "emoji": "🌙",
 *                       "state": { "entity": "light.x", "on": ["on"] },
 *                       "on":  { "service": "light/turn_on",  "data": { "entity_id": "light.x" } },
 *                       "off": { "service": "light/turn_off", "data": { "entity_id": "light.x" } } } ],
 *       "sleepTimer": { "entity": "number.x", "maxMinutes": 90, "chips": [0, 15, 30, 45, 60], "unit": "seconds" } } }
 * Needs HA_URL and HA_TOKEN.
 */
const fs = require('fs');
const { dataDir } = require('./util');

const HA_URL = (process.env.HA_URL || '').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN || '';
const SERVICE_RE = /^[a-z_]+\/[a-z0-9_]+$/;
const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;

function configFor(kid) {
  let all = null;
  try { all = JSON.parse(fs.readFileSync(dataDir('room.json'), 'utf8')); } catch (_) { /* no file */ }
  if (!all && process.env.KIDS_ROOM_CONTROLS) { try { all = JSON.parse(process.env.KIDS_ROOM_CONTROLS); } catch (_) { all = null; } }
  const c = all && all[String(kid.slug || '').toLowerCase()];
  if (!c) return null;
  const controls = {};
  for (const x of c.controls || []) {
    if (!x || !/^[a-z0-9_]{1,40}$/.test(x.key || '') || !x.on || !x.off) continue;
    if (!SERVICE_RE.test(x.on.service || '') || !SERVICE_RE.test(x.off.service || '')) continue;
    controls[x.key] = x;
  }
  const st = c.sleepTimer && ENTITY_RE.test(c.sleepTimer.entity || '') ? c.sleepTimer : null;
  return { controls, sleepTimer: st };
}

async function ha(p, { method = 'GET', body } = {}) {
  if (!HA_URL || !HA_TOKEN) throw new Error('Home Assistant isn’t set up');
  const r = await fetch(`${HA_URL}/api/${p}`, { method, headers: { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Home Assistant said ${r.status}`);
  return r.json();
}

module.exports = {
  routes(r, { util }) {
    r.get('/room', async (req, res) => {
      const cfg = configFor(req.kid);
      if (!cfg || (!Object.keys(cfg.controls).length && !cfg.sleepTimer)) return res.json({ ok: true, configured: false, controls: {} });
      const out = {};
      await Promise.all(Object.entries(cfg.controls).map(async ([key, c]) => {
        const base = { label: c.label || key, emoji: c.emoji || '💡' };
        try {
          const ent = c.state && c.state.entity;
          if (!ent || !ENTITY_RE.test(ent)) { out[key] = { ...base, on: false, available: true }; return; }
          const s = await ha(`states/${ent}`);
          const onStates = (c.state.on || ['on']).map(String);
          out[key] = { ...base, on: onStates.includes(String(s.state)), available: s.state !== 'unavailable' };
        } catch (_) { out[key] = { ...base, on: false, available: false }; }
      }));
      let sleep = null;
      if (cfg.sleepTimer) {
        const t = cfg.sleepTimer;
        let secs = 0;
        try { const s = await ha(`states/${t.entity}`); secs = Math.round(parseFloat(s.state) || 0) * (t.unit === 'minutes' ? 60 : 1); } catch (_) { /* player asleep */ }
        sleep = { seconds: secs, maxMinutes: Math.min(180, t.maxMinutes || 90), chips: (t.chips || [0, 15, 30, 45, 60]).filter((n) => n <= (t.maxMinutes || 90)) };
      }
      res.json({ ok: true, configured: true, controls: out, sleep, sleep_timer_s: sleep ? sleep.seconds : 0 });
    });

    r.post('/room/timer/sleep', async (req, res) => {
      const cfg = configFor(req.kid);
      if (!cfg || !cfg.sleepTimer) return res.status(404).json({ ok: false, error: 'No sleep timer here' });
      const t = cfg.sleepTimer;
      const mins = Math.max(0, Math.min(t.maxMinutes || 90, parseInt((req.body || {}).minutes, 10) || 0));
      try {
        await ha('services/number/set_value', { method: 'POST', body: { entity_id: t.entity, value: t.unit === 'minutes' ? mins : mins * 60 } });
        util.audit(req.uid, 'room_sleep_timer', { child: req.kid.id, minutes: mins });
        res.json({ ok: true, minutes: mins });
      } catch (e) { res.status(502).json({ ok: false, error: 'Couldn’t reach your room just now' }); }
    });

    r.post('/room/:key', async (req, res) => {
      const cfg = configFor(req.kid);
      const c = cfg && cfg.controls[req.params.key];
      if (!c) return res.status(404).json({ ok: false, error: 'unknown_control' });
      const want = (req.body || {}).on === true;
      const action = want ? c.on : c.off;
      try {
        await ha(`services/${action.service}`, { method: 'POST', body: action.data || {} });
        util.audit(req.uid, 'room_switch', { child: req.kid.id, key: req.params.key, on: want });
        res.json({ ok: true, on: want });
      } catch (e) { res.status(502).json({ ok: false, error: 'Couldn’t reach your room just now' }); }
    });
  },
};
