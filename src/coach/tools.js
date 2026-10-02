/*
 * The coach's tools — its ENTIRE reach. Everything acts on Pippin's own data for this one person.
 * There is deliberately no shell, web, file-system, email, calendar or home-automation tool.
 */
const { pool } = require('../db');
const game = require('../game');
const { encrypt, decrypt } = require('./crypto');
const people = require('./people');

const DEFS = [
  { name: 'save_commitment', description: 'Save an if-then plan so the app can nudge at the right moment. Use after agreeing a concrete first step.',
    parameters: { type: 'object', properties: {
      what: { type: 'string', description: 'The first tiny step, starting with a verb' },
      when_text: { type: 'string', description: 'The cue, e.g. "after the school run" or "14:00"' },
      time: { type: 'string', description: 'Optional clock time HH:MM for the nudge' },
      day: { type: 'string', enum: ['today', 'tomorrow'], description: 'Which day the time is on' },
      barrier: { type: 'string', description: 'Likely thing that gets in the way' },
      backup: { type: 'string', description: 'What they will do if the barrier happens' },
    }, required: ['what'] } },
  { name: 'add_to_inbox', description: 'Capture a to-do in their single inbox list so it is out of their head.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, due_on: { type: 'string', description: 'YYYY-MM-DD if there is a deadline' } }, required: ['text'] } },
  { name: 'add_goal_today', description: 'Add a goal to today’s list on the home screen, with tiny steps.',
    parameters: { type: 'object', properties: { title: { type: 'string' },
      category: { type: 'string', enum: ['body', 'mind', 'home', 'people', 'work', 'money', 'admin', 'fun', 'rest'] },
      steps: { type: 'array', items: { type: 'string' } } }, required: ['title'] } },
  { name: 'list_inbox', description: 'See their open inbox items and open if-then plans.', parameters: { type: 'object', properties: {} } },
  { name: 'people_due', description: 'People they might want to contact: overdue for their chosen rhythm, or birthdays coming up. Contact metadata only.',
    parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'get_week_summary', description: 'Summary of the last 7 days: check-ins, mood, goals done by category, plans kept, tool use.', parameters: { type: 'object', properties: {} } },
  { name: 'propose_memory', description: 'Propose something worth remembering (decision, insight, win, pattern, weekly summary). They approve before it is saved to their journal.',
    parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['note', 'insight', 'win', 'weekly'] }, title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] } },
  { name: 'save_profile', description: 'Save what you learned in the intake (their goals, strengths, struggles, routines, support people). Merges with what is there.',
    parameters: { type: 'object', properties: { profile: { type: 'object', additionalProperties: true } }, required: ['profile'] } },
  { name: 'add_habit', description: 'Create a habit as an if-then: after an existing routine, a tiny version. Use when they want to build a habit or an "instead" behaviour.',
    parameters: { type: 'object', properties: {
      title: { type: 'string' }, anchor: { type: 'string', description: 'The existing routine, e.g. "I pour my morning coffee"' },
      tiny: { type: 'string', description: 'The tiny version, e.g. "do 2 press-ups"' }, per_week: { type: 'integer', minimum: 1, maximum: 7 },
      remind_at: { type: 'string', description: 'Optional HH:MM' } }, required: ['title', 'anchor', 'tiny'] } },
  { name: 'save_risk_event', description: 'Save a plan for a high-risk event (party, work do, holiday) on their sobriety tracker.',
    parameters: { type: 'object', properties: {
      title: { type: 'string' }, on_date: { type: 'string', description: 'YYYY-MM-DD' }, drink: { type: 'string', description: 'What they will drink instead' },
      script: { type: 'string', description: 'What they will say if offered a drink' }, exit: { type: 'string', description: 'When/how they will leave or get support' },
      plan: { type: 'string' } }, required: ['title'] } },
  { name: 'suggest_tool', description: 'Offer one of the app’s tools as a button: focus timer, breathing, stretch, sounds.',
    parameters: { type: 'object', properties: { tool: { type: 'string', enum: ['focus', 'breathe', 'stretch', 'sounds', 'reflect'] } }, required: ['tool'] } },
];

function localTimeToDate(tz, day, hhmm) {
  // Build a Date for HH:MM on today/tomorrow in the user's timezone.
  const today = game.localDay(tz);
  const d = new Date(today + 'T12:00:00Z');
  if (day === 'tomorrow') d.setUTCDate(d.getUTCDate() + 1);
  const [h, m] = hhmm.split(':').map(Number);
  const guess = new Date(`${d.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const offsetMin = (new Date(guess.toLocaleString('en-US', { timeZone: tz })) - new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000;
  return new Date(guess.getTime() - offsetMin * 60000);
}

async function run(uid, name, args, out) {
  const user = await game.getUser(uid);
  switch (name) {
    case 'save_commitment': {
      let due = null;
      if (args.time && /^\d{1,2}:\d{2}$/.test(args.time)) due = localTimeToDate(user.tz, args.day, args.time);
      const { rows } = await pool.query(
        `INSERT INTO commitments(user_id, what, when_text, due_at, barrier, backup) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [uid, String(args.what).slice(0, 200), args.when_text || args.time || null, due, args.barrier || null, args.backup || null]);
      out.actions.push({ type: 'commitment', id: rows[0].id, what: args.what, when: args.when_text || args.time || '' });
      return { saved: true, nudge_at: due ? due.toISOString() : null };
    }
    case 'add_to_inbox': {
      await pool.query('INSERT INTO inbox_items(user_id, text, due_on) VALUES ($1,$2,$3)',
        [uid, String(args.text).slice(0, 300), /^\d{4}-\d{2}-\d{2}$/.test(args.due_on || '') ? args.due_on : null]);
      out.actions.push({ type: 'inbox', text: args.text });
      return { saved: true };
    }
    case 'add_goal_today': {
      const day = game.localDay(user.tz);
      await pool.query(`INSERT INTO goals(user_id, title, category, days, once_on, steps, source) VALUES ($1,$2,$3,'{}',$4,$5,'coach')`,
        [uid, String(args.title).slice(0, 80), args.category || 'general', day,
          JSON.stringify((args.steps || []).slice(0, 6).map((t) => ({ text: String(t).slice(0, 120), done: false })))]);
      out.actions.push({ type: 'goal', text: args.title });
      return { saved: true };
    }
    case 'list_inbox': {
      const { rows: inbox } = await pool.query(`SELECT text, due_on FROM inbox_items WHERE user_id=$1 AND status='open' ORDER BY due_on NULLS LAST, created_at LIMIT 25`, [uid]);
      const { rows: plans } = await pool.query(`SELECT what, when_text, due_at FROM commitments WHERE user_id=$1 AND status='open' ORDER BY due_at NULLS LAST LIMIT 15`, [uid]);
      return { inbox, plans };
    }
    case 'people_due': return { people: await people.due(uid, Math.min(8, args.limit || 5)) };
    case 'get_week_summary': return weekSummary(uid);
    case 'propose_memory': {
      const { rows } = await pool.query(`INSERT INTO memories(user_id, kind, title, body) VALUES ($1,$2,$3,$4) RETURNING id`,
        [uid, ['note', 'insight', 'win', 'weekly'].includes(args.kind) ? args.kind : 'note', String(args.title).slice(0, 120), String(args.body).slice(0, 4000)]);
      out.actions.push({ type: 'memory', id: rows[0].id, title: args.title });
      return { proposed: true, note: 'They will see a Save / Skip button.' };
    }
    case 'save_profile': {
      const { rows } = await pool.query('SELECT data_enc FROM coach_profile WHERE user_id=$1', [uid]);
      const current = rows.length ? JSON.parse(decrypt(rows[0].data_enc)) : {};
      const merged = { ...current, ...(args.profile || {}), updated: new Date().toISOString() };
      await pool.query(`INSERT INTO coach_profile(user_id, data_enc) VALUES ($1,$2)
                        ON CONFLICT (user_id) DO UPDATE SET data_enc=$2, updated_at=NOW()`, [uid, encrypt(JSON.stringify(merged))]);
      return { saved: true };
    }
    case 'suggest_tool': out.actions.push({ type: 'tool', tool: args.tool }); return { shown: true };
    case 'add_habit': {
      const { rows: [{ n }] } = await pool.query(`SELECT COUNT(*)::int n FROM habits WHERE user_id=$1 AND status='building'`, [uid]);
      const status = n >= 3 ? 'parked' : 'building';
      await pool.query(`INSERT INTO habits(user_id, title, anchor, tiny, per_week, remind_at, status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uid, String(args.title).slice(0, 60), String(args.anchor || '').slice(0, 120), String(args.tiny || '').slice(0, 120),
          Math.max(1, Math.min(7, args.per_week || 4)), /^\d{2}:\d{2}$/.test(args.remind_at || '') ? args.remind_at : null, status]);
      out.actions.push({ type: 'habit', text: args.title, status });
      return { saved: true, status, note: status === 'parked' ? 'They already have 3 habits building, so this was parked.' : '' };
    }
    case 'save_risk_event': {
      const { rows: t } = await pool.query(`SELECT id FROM trackers WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at LIMIT 1`, [uid]);
      if (!t.length) return { error: 'They have no tracker yet — suggest setting one up in the app.' };
      await pool.query(`INSERT INTO risk_events(tracker_id, user_id, title, on_date, plan, drink, exit, script, refreshed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [t[0].id, uid, String(args.title).slice(0, 80), /^\d{4}-\d{2}-\d{2}$/.test(args.on_date || '') ? args.on_date : null,
          args.plan || null, args.drink || null, args.exit || null, args.script || null]);
      out.actions.push({ type: 'event', text: args.title });
      return { saved: true };
    }
    default: return { error: 'unknown tool' };
  }
}

async function weekSummary(uid) {
  const q = (sql) => pool.query(sql, [uid]).then((r) => r.rows);
  const [mood, cats, plans, tools, checkins] = await Promise.all([
    q(`SELECT day::text, mood, energy, emotions FROM checkins WHERE user_id=$1 AND day > CURRENT_DATE - 7 ORDER BY day`),
    q(`SELECT g.category, COUNT(*)::int n FROM goal_completions c JOIN goals g ON g.id=c.goal_id WHERE c.user_id=$1 AND NOT c.undone AND c.day > CURRENT_DATE - 7 GROUP BY g.category`),
    q(`SELECT status, COUNT(*)::int n FROM commitments WHERE user_id=$1 AND created_at > NOW() - interval '7 days' GROUP BY status`),
    q(`SELECT kind, COUNT(*)::int n, SUM(seconds)::int secs FROM tool_sessions WHERE user_id=$1 AND day > CURRENT_DATE - 7 GROUP BY kind`),
    q(`SELECT COUNT(DISTINCT day)::int days FROM checkins WHERE user_id=$1 AND day > CURRENT_DATE - 7`),
  ]);
  return { checkin_days: checkins[0]?.days || 0, mood_by_day: mood, goals_done_by_category: cats, plans_by_status: plans, tool_sessions: tools };
}

module.exports = { DEFS: DEFS.map((d) => ({ type: 'function', function: d })), run, weekSummary };
