/*
 * Time-of-day rules for a child's app (users.settings.kids.access.rules), enforced on the server.
 *   rules: [{ from: '19:00', to: '19:30', allow: ['yoto','books'] }, { from: '19:30', to: '07:00', allow: [] }]
 * A rule covers from..to (wraps past midnight when to < from). In a window only the listed modules work;
 * no rule = full access. Parents are never restricted. Always-allowed: /me, /push, /auth (so the app can say why).
 */
const ALWAYS = ['me', 'push', 'auth'];
const SEG_TO_MODULE = { notes: 'hopenotes', jobs: 'responsibilities', plan: 'responsibilities' };

const minsOf = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map((x) => parseInt(x, 10) || 0); return h * 60 + m; };
const nowMins = (tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10);
};

/** → { allow: null (everything) | Set of module ids, until: 'HH:MM' | null } */
function accessNow(kid, tz = (kid && kid.tz) || process.env.TZ_DEFAULT || 'Europe/London') {
  const rules = (((kid && kid.settings) || {}).kids || {}).access?.rules || [];
  const t = nowMins(tz);
  for (const r of rules) {
    const a = minsOf(r.from), b = minsOf(r.to);
    const inside = a <= b ? (t >= a && t < b) : (t >= a || t < b);
    if (inside) return { allow: new Set(r.allow || []), until: r.to, from: r.from };
  }
  return { allow: null, until: null, from: null };
}

const moduleOf = (seg) => SEG_TO_MODULE[seg] || seg;

/** Express middleware for child requests (after resolveChild, which sets req.kid). */
function gate(req, res, next) {
  if (req.role !== 'child' || !req.kid) return next();
  const info = accessNow(req.kid);
  if (!info.allow) return next();
  const seg = String(req.path || '/').split('/').filter(Boolean)[0] || '';
  if (ALWAYS.includes(seg) || info.allow.has(moduleOf(seg))) return next();
  return res.status(403).json({ ok: false, blocked: true, until: info.until, error: `Not right now — back at ${info.until}` });
}

module.exports = { accessNow, gate, ALWAYS, moduleOf };
