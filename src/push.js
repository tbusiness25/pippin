/*
 * Web Push nudges. Deliberately few: morning check-in, evening check-in, "your sprig is home",
 * and messages from friends. Each nudge is sent at most once per day/event (push_sent), and only
 * if the person switched nudges on. VAPID keys come from env, or are generated once and stored.
 */
const { APP_NAME } = require('./brand');
const webpush = require('web-push');
const { pool } = require('./db');
const game = require('./game');

let ready = false;
let publicKey = null;

async function init() {
  let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const { rows } = await pool.query(`SELECT key, value FROM app_secrets WHERE key IN ('vapid_public','vapid_private')`);
    pub = rows.find((r) => r.key === 'vapid_public')?.value;
    priv = rows.find((r) => r.key === 'vapid_private')?.value;
    if (!pub || !priv) {
      const k = webpush.generateVAPIDKeys();
      pub = k.publicKey; priv = k.privateKey;
      await pool.query(`INSERT INTO app_secrets(key, value) VALUES ('vapid_public',$1),('vapid_private',$2)`, [pub, priv]);
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@localhost', pub, priv);
  publicKey = pub;
  ready = true;
  setInterval(() => tick().catch((e) => console.error('[push tick]', e.message)), 60 * 1000);
}

/** Send once per (user, kind, ref). Returns number of devices reached. */
// Kinds that count toward the daily cap and respect "quiet today". Plans, homecomings and friends don't.
const CAPPED = new Set(['voice', 'monthly-check', 'pledge', 'sober', 'habit', 'event', 'fresh', 'lapse-followup', 'morning', 'evening']);

async function notify(uid, kind, body, { ref, title = APP_NAME, url = '/#home', actions, data } = {}) {
  if (!ready) return 0;
  const u = await game.getUser(uid);
  if (!u || !(u.settings || {}).nudges) return 0;
  if (CAPPED.has(kind)) {
    const today = game.localDay(u.tz);
    if ((u.settings || {}).quiet_day === today) return 0;
    const { rows: [{ n }] } = await pool.query(
      `SELECT COUNT(*)::int n FROM push_sent WHERE user_id=$1 AND kind = ANY($2) AND sent_at > NOW() - interval '20 hours'`, [uid, [...CAPPED]]);
    if (n >= ((u.settings || {}).push_cap || 4)) return 0;
  }
  const { rowCount } = await pool.query(
    'INSERT INTO push_sent(user_id, kind, ref) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [uid, kind, ref || String(Date.now())]);
  if (!rowCount) return 0;
  const { rows } = await pool.query('SELECT id, endpoint, keys FROM push_subscriptions WHERE user_id=$1', [uid]);
  let sent = 0;
  for (const s of rows) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title, body, url, actions, data, tag: kind }), { TTL: 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await pool.query('DELETE FROM push_subscriptions WHERE id=$1', [s.id]);
      else console.warn('[push]', e.statusCode || e.message);
    }
  }
  return sent;
}

const hhmm = (tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

async function tick() {
  const { rows: users } = await pool.query(
    `SELECT u.id, u.tz, u.settings, p.name pet FROM users u JOIN pets p ON p.user_id=u.id AND p.deleted_at IS NULL
     WHERE u.deleted_at IS NULL AND (u.settings->>'nudges')::boolean IS TRUE`);
  for (const u of users) {
    const s = u.settings;
    const now = hhmm(u.tz);
    const day = game.localDay(u.tz);
    const checkedIn = async (kind) =>
      (await pool.query('SELECT 1 FROM checkins WHERE user_id=$1 AND day=$2 AND kind=$3', [u.id, day, kind])).rows.length > 0;
    if (now >= (s.morning_time || '09:00') && now < '12:00' && !(await checkedIn('morning'))) {
      await notify(u.id, 'morning', `Morning! ${u.pet} would love to know how you’re feeling.`, { ref: day });
    }
    if (now >= (s.evening_time || '20:30') && now <= '23:30' && !(await checkedIn('evening'))) {
      await notify(u.id, 'evening', `How was today? ${u.pet} is saving you a spot.`, { ref: day });
    }
  }
  await habitAndSoberNudges().catch((e) => console.error('[push habits/sober]', e.message));
  // If-then plans at their time — point of performance. Generic text: no task names on a lock screen.
  const { rows: plans } = await pool.query(
    `SELECT c.id, c.user_id FROM commitments c JOIN users u ON u.id=c.user_id
     WHERE c.status='open' AND c.due_at IS NOT NULL AND c.due_at <= NOW() AND c.due_at > NOW() - interval '30 minutes' AND c.nudged_at IS NULL
       AND (u.settings->>'nudges')::boolean IS TRUE`);
  for (const c of plans) {
    await notify(c.user_id, 'plan', '⏰ It’s time for something you planned. Starting now?', { ref: c.id, url: '/#coach' });
    await pool.query('UPDATE commitments SET nudged_at=NOW() WHERE id=$1', [c.id]);
  }
  // Adventures that have ended: tell their owner once.
  const { rows: home } = await pool.query(
    `SELECT a.id, a.place, p.name, p.user_id FROM adventures a JOIN pets p ON p.id=a.pet_id
     WHERE a.returned_at IS NULL AND a.ends_at <= NOW() AND a.ends_at > NOW() - interval '1 day'`);
  for (const a of home) await notify(a.user_id, 'home', `${a.name} is home from ${a.place} with a story for you!`, { ref: a.id });
}

/*
 * Habit + sobriety nudges (research: docs/research/reports/Habit and sobriety tracker design.md):
 * morning pledge, evening check-in with one-tap action, habit reminders with Done/Mini actions,
 * the evening before a risky event, ONE follow-up the morning after a lapse, a Monday fresh start.
 * Lock-screen text never names a substance or behaviour. Never: broken-streak or "missed X days" alerts.
 */
async function habitAndSoberNudges() {
  const { rows: users } = await pool.query(
    `SELECT id, tz, settings FROM users WHERE deleted_at IS NULL AND (settings->>'nudges')::boolean IS TRUE`);
  for (const u of users) {
    const s = u.settings || {};
    const now = hhmm(u.tz);
    const day = game.localDay(u.tz);
    const weekday = game.localWeekday(u.tz);
    const within = (t, mins = 90) => { if (!t) return false; const [h, m] = t.split(':').map(Number); const [nh, nm] = now.split(':').map(Number); const d = (nh * 60 + nm) - (h * 60 + m); return d >= 0 && d < mins; };
    const { rows: trackers } = await pool.query(
      `SELECT id, start_date::text FROM trackers WHERE user_id=$1 AND archived_at IS NULL AND start_date <= $2`, [u.id, day]);
    for (const t of trackers) {
      const { rows: logged } = await pool.query('SELECT status FROM tracker_days WHERE tracker_id=$1 AND day=$2', [t.id, day]);
      const { rows: pledged } = await pool.query('SELECT 1 FROM pledges WHERE tracker_id=$1 AND day=$2', [t.id, day]);
      // One gentle note the morning after a lapse — then back to normal. Never a series.
      const yesterday = new Date(day + 'T12:00:00Z'); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yd = yesterday.toISOString().slice(0, 10);
      const { rows: lapsed } = await pool.query(`SELECT 1 FROM tracker_days WHERE tracker_id=$1 AND day=$2 AND status='lapse'`, [t.id, yd]);
      if (lapsed.length && within(s.pledge_time || '08:30')) {
        await notify(u.id, 'lapse-followup', 'Yesterday’s logged. Today’s plan is ready whenever you are. 🌱', { ref: `${t.id}:${day}`, url: '/#sober' });
      } else if (!pledged.length && !logged.length && within(s.pledge_time || '08:30')) {
        await notify(u.id, 'pledge', 'Morning 🌱 — one day at a time. Today’s plan is ready.', { ref: `${t.id}:${day}`, url: '/#sober' });
      }
      if (!logged.length && within(s.sober_time || '21:00', 150)) {
        await notify(u.id, 'sober', 'Evening check-in — how did today go?', { ref: `${t.id}:${day}`, url: '/#sober',
          actions: [{ action: 'sober-free', title: '✓ Good day' }, { action: 'open', title: 'Open' }], data: { tracker: t.id, day } });
      }
      // The evening before a known risky event: refresh the plan (if-then effects fade).
      const tomorrow = new Date(day + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const { rows: ev } = await pool.query('SELECT id FROM risk_events WHERE tracker_id=$1 AND on_date=$2 LIMIT 1', [t.id, tomorrow.toISOString().slice(0, 10)]);
      if (ev.length && within('18:00')) await notify(u.id, 'event', 'Something’s coming up tomorrow — want to look over your plan?', { ref: ev[0].id, url: '/#sober' });
    }
    // Habit reminders at the person's chosen time, with one-tap logging.
    const { rows: habits } = await pool.query(
      `SELECT h.id, h.title, h.remind_at FROM habits h
       WHERE h.user_id=$1 AND h.status='building' AND h.remind_at IS NOT NULL AND $2 = ANY(h.remind_days)
         AND NOT EXISTS (SELECT 1 FROM habit_logs l WHERE l.habit_id=h.id AND l.day=$3)`, [u.id, weekday, day]);
    for (const h of habits) {
      if (within(h.remind_at, 60)) await notify(u.id, 'habit', `Time for: ${h.title}`, { ref: `${h.id}:${day}`, url: '/#habits',
        actions: [{ action: 'habit-done', title: '✓ Done' }, { action: 'habit-mini', title: 'Mini version' }], data: { habit: h.id, day } });
    }
    // Monthly questionnaire(s), late morning, when due. Generic text — never names the questionnaire.
    if (within('10:30', 60)) {
      try {
        const { checks } = await require('./routes/tools').checksDue(u.id);
        const due = checks.find((c) => c.due && c.last);              // only after they've done it once themselves
        if (due) await notify(u.id, 'monthly-check', 'Your monthly check-in is ready — 2 minutes, and it builds a picture over time.', { ref: `${due.quiz}:${day.slice(0, 7)}`, url: `/#explore/quizzes/${due.quiz}` });
      } catch (_) {}
    }
    // Fresh start (Mondays): a gentle restart offer if last week was light. Not a "you missed" message.
    if (weekday === 1 && within('09:00', 60)) {
      const { rows: light } = await pool.query(`
        SELECT 1 FROM habits h WHERE h.user_id=$1 AND h.status='building' AND h.created_at < NOW() - interval '7 days'
          AND (SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id=h.id AND l.status <> 'skip' AND l.day >= $2::date - 7 AND l.day < $2::date) < h.per_week LIMIT 1`, [u.id, day]);
      if (light.length) await notify(u.id, 'fresh', 'New week, fresh start. Want to pick the two-minute version of one habit?', { ref: day, url: '/#habits' });
    }
  }
}

module.exports = { init, notify, getPublicKey: () => publicKey };
