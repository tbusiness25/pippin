/*
 * One coach turn: crisis screen (code) → context → model with Pippin-only tools → encrypted storage.
 * Nothing in here logs message content.
 */
const { pool } = require('../db');
const game = require('../game');
const llm = require('./llm');
const crisis = require('./crisis');
const tools = require('./tools');
const people = require('./people');
const vault = require('./vault');
const style = require('./style');
const library = require('./library');
const { encrypt, decrypt } = require('./crypto');
const { PERSONA, FLOWS } = require('./prompt');

const HISTORY = 16;
const MAX_TOOL_ROUNDS = 4;
const LOOKUP = { type: 'function', function: { name: 'look_up_health_info',
  description: 'Search the NHS website pages they chose for their health library. Use it for health facts: symptoms, getting a diagnosis, treatments, side effects, alcohol units, sleep, support services.',
  parameters: { type: 'object', properties: { query: { type: 'string', description: 'What to look up, in plain words' } }, required: ['query'] } } };
const LIBRARY_RULES = `HEALTH LIBRARY
- They've chosen pages from the NHS website for you to use. For health facts (symptoms, diagnosis, treatments, side effects,
  alcohol units, sleep, where to get help) rely on these passages, not your own memory; look things up with look_up_health_info.
- Say it briefly in your own words. The passages are already shown to them under your reply with a link, so say "the NHS page
  below has more" — never offer to look it up or pull it up for them.
  Don't claim the NHS says anything that isn't in a passage. If the pages don't cover it, say so and suggest their GP or pharmacist.
- The library never changes your LIMITS: still no doses, no stopping or swapping medicines, no diagnosing.`;
const addSources = (out, hits) => {
  for (const h of hits) if (!out.sources.some((x) => x.source === h.source && x.heading === h.heading)) out.sources.push(h);
};

const CLAIM = /\b(i'?ve|i have|i'?ll|i will|i’ve|i’ll)\s+(just\s+)?(saved|save|added|add|set|scheduled|booked|logged|noted|put)\b|\b(saved|added)\s+(it|that|this|your)\b|\bnudge (is )?set\b/i;

async function profileOf(uid) {
  const { rows } = await pool.query('SELECT data_enc FROM coach_profile WHERE user_id=$1', [uid]);
  try { return rows.length ? JSON.parse(decrypt(rows[0].data_enc)) : null; } catch { return null; }
}

/** A compact picture of today for the model. Facts only; no other people's content. */
async function context(uid) {
  const user = await game.getUser(uid);
  const pet = await game.getPet(uid);
  const day = game.localDay(user.tz);
  const nowLocal = new Intl.DateTimeFormat('en-GB', { timeZone: user.tz, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const q = (sql, p = [uid]) => pool.query(sql, p).then((r) => r.rows);
  const [ck, goals, plans, inbox, mood7, lastSeen, journeys] = await Promise.all([
    q(`SELECT kind, mood, energy, emotions FROM checkins WHERE user_id=$1 AND day=$2`, [uid, day]),
    q(`SELECT g.title, g.category, (c.id IS NOT NULL AND NOT c.undone) done FROM goals g
       LEFT JOIN goal_completions c ON c.goal_id=g.id AND c.day=$2
       WHERE g.user_id=$1 AND g.deleted_at IS NULL AND ((g.once_on IS NULL AND $3 = ANY(g.days)) OR g.once_on=$2)`, [uid, day, game.localWeekday(user.tz)]),
    q(`SELECT what, when_text, due_at FROM commitments WHERE user_id=$1 AND status='open' ORDER BY due_at NULLS LAST LIMIT 6`),
    q(`SELECT text, due_on FROM inbox_items WHERE user_id=$1 AND status='open' ORDER BY due_on NULLS LAST, created_at LIMIT 8`),
    q(`SELECT ROUND(AVG(mood)::numeric,1)::float m, COUNT(DISTINCT day)::int d FROM checkins WHERE user_id=$1 AND day > CURRENT_DATE - 7`),
    q(`SELECT MAX(day)::text d FROM (SELECT day FROM checkins WHERE user_id=$1 UNION SELECT day FROM goal_completions WHERE user_id=$1) x`),
    q(`SELECT journey, step FROM journeys WHERE user_id=$1 AND finished_at IS NULL AND abandoned_at IS NULL`),
  ]);
  const due = await people.due(uid, 3);
  const trackers = await q(`SELECT t.id, t.category, t.label, t.start_date::text sd, t.reasons,
      (SELECT COUNT(*) FROM tracker_days d WHERE d.tracker_id=t.id AND d.status='free')::int free,
      (SELECT COUNT(*) FROM tracker_days d WHERE d.tracker_id=t.id AND d.status='lapse')::int lapses,
      (SELECT status FROM tracker_days d WHERE d.tracker_id=t.id AND d.day=$2) today,
      (SELECT string_agg(title || COALESCE(' on ' || on_date::text, ''), '; ') FROM risk_events e WHERE e.tracker_id=t.id AND (e.on_date IS NULL OR e.on_date >= $2)) events,
      (SELECT COUNT(*) FROM urges u WHERE u.tracker_id=t.id AND u.at > NOW() - interval '7 days')::int urges7
    FROM trackers t WHERE t.user_id=$1 AND t.archived_at IS NULL`, [uid, day]);
  const habits = await q(`SELECT h.title, h.anchor, h.tiny, h.per_week,
      (SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id=h.id AND l.status<>'skip' AND l.day > $2::date - 7)::int last7,
      (SELECT status FROM habit_logs l WHERE l.habit_id=h.id AND l.day=$2) today
    FROM habits h WHERE h.user_id=$1 AND h.status='building'`, [uid, day]);
  const prof = await profileOf(uid);
  const lines = [
    `Now: ${nowLocal} (${day}).`,
    ck.length ? `Today's check-ins: ${ck.map((c) => `${c.kind} mood ${c.mood}/5${c.energy ? `, energy ${c.energy}/5` : ''}${c.emotions?.length ? ` (${c.emotions.join(', ')})` : ''}`).join('; ')}.` : 'No check-in yet today.',
    `Last 7 days: average mood ${mood7[0]?.m ?? 'n/a'} over ${mood7[0]?.d || 0} check-in days. Last active day: ${lastSeen[0]?.d || 'never'}.`,
    `Today's goals: ${goals.length ? goals.map((g) => `${g.done ? '✓' : '○'} ${g.title}`).join('; ') : 'none'}.`,
    `Open if-then plans: ${plans.length ? plans.map((p) => `${p.what}${p.when_text ? ` (${p.when_text})` : ''}`).join('; ') : 'none'}.`,
    `Inbox (${inbox.length}${inbox.length === 8 ? '+' : ''}): ${inbox.map((i) => i.text + (i.due_on ? ` [due ${i.due_on}]` : '')).join('; ') || 'empty'}.`,
    journeys.length ? `Active journeys: ${journeys.map((j) => `${j.journey} (day ${j.step})`).join(', ')}.` : '',
    due.length ? `People they might reach out to: ${due.map((p) => `${p.name} — ${p.reason}`).join('; ')}.` : '',
    prof ? `What they've told you about themselves: ${JSON.stringify(prof).slice(0, 1500)}` : 'No intake yet — if it fits naturally, offer the "Tell my coach about me" chat.',
    habits.length ? `Habits being built: ${habits.map((h) => `${h.title} (after ${h.anchor || '?'} → ${h.tiny || '?'}; ${h.last7}/${h.per_week} this week${h.today ? `, today ${h.today}` : ''})`).join('; ')}.` : '',
    ...trackers.map((t) => `Tracker "${t.label}" (${t.category}, started ${t.sd}): ${t.free} free days total, ${t.lapses} lapse days; today ${t.today || 'not logged yet'}; ${t.urges7} urges logged in 7 days.${t.events ? ` Upcoming risk events: ${t.events}.` : ''}${t.reasons?.length ? ` Their reasons: ${t.reasons.join('; ')}.` : ''} (Never use these numbers as pressure.)`),
    pet ? `Their sprig: ${pet.name}.` : '',
  ].filter(Boolean);
  return { text: lines.join('\n'), user, pet, lastSeen: lastSeen[0]?.d };
}

async function history(uid) {
  const { rows } = await pool.query(
    `SELECT role, body_enc FROM (SELECT * FROM coach_messages WHERE user_id=$1 AND thread_id IS NULL AND role IN ('user','assistant') ORDER BY id DESC LIMIT $2) m ORDER BY id`,
    [uid, HISTORY]);
  return rows.map((r) => { try { return { role: r.role, content: decrypt(r.body_enc) }; } catch { return null; } }).filter(Boolean);
}

async function store(uid, role, text, flow, sources) {
  const refs = sources?.length ? JSON.stringify(sources.map((s) => ({ source: s.source, heading: s.heading }))) : null;
  await pool.query('INSERT INTO coach_messages(user_id, role, body_enc, flow, sources) VALUES ($1,$2,$3,$4,$5)', [uid, role, encrypt(text), flow || null, refs]);
}

/** Run one turn. Either `text` (the person typed/spoke) or `flow` (they tapped a guided flow). */
async function turn(uid, { text, flow }) {
  const out = { reply: '', crisis: null, actions: [], sources: [] };
  const userText = String(text || '').trim();
  const level = userText ? crisis.screen(userText) : null;
  if (level) {
    out.crisis = { level, resources: crisis.resources(level) };
    await pool.query('INSERT INTO crisis_events(user_id, level) VALUES ($1,$2)', [uid, level]);
  }
  const ctx = await context(uid);
  const name = ctx.user.name || 'the person';
  const prefs = await style.get(uid);
  const urgent = level === 'high' || level === 'medical';
  const sys = [PERSONA(name, ctx.pet?.name)];
  if (prefs.library.length) sys.push(`\n${LIBRARY_RULES}`);
  sys.push(`\nCONTEXT\n${ctx.text}`);
  // Automatic look-up when they mention a health topic, so even models that skip tool calls get the facts.
  if (prefs.library.length && userText && !urgent && library.onTopic(userText)) {
    const hits = library.search(userText, prefs.library, { k: 2, minScore: 2 });
    if (hits.length) {
      addSources(out, hits);
      sys.push(`\nNHS PASSAGES FOR THIS MESSAGE (they'll see these under your reply)\n${hits.map((h) => `[${h.title} — ${h.heading}]\n${h.text}`).join('\n\n')}`);
    }
  }
  // Their style goes last so the model actually follows it; the block itself says the rules above still win.
  const prefBlock = style.promptBlock(name, prefs);
  if (prefBlock && !urgent) sys.push(prefBlock);
  if (level) sys.push(`\n${crisis.MODEL_GUIDANCE[level]}`);
  const safety = (ctx.user.settings || {}).safety_plan;
  if (level && safety?.person) sys.push(`Their safety plan names ${safety.person} as someone to contact.`);

  const msgs = [{ role: 'system', content: sys.join('\n') }, ...(await history(uid))];
  if (flow && FLOWS[flow]) {
    // Data-heavy flows get their facts up front — local models often skip a tool call they "should" make.
    let facts = '';
    if (flow === 'weekly') facts = `\nWEEK DATA (from get_week_summary): ${JSON.stringify(await tools.weekSummary(uid))}`;
    if (flow === 'people' || flow === 'weekly') facts += `\nPEOPLE DUE (from people_due): ${JSON.stringify(await people.due(uid, 5))}`;
    msgs.push({ role: 'user', content: `[${name} tapped "${FLOWS[flow].label}". Coach instructions: ${FLOWS[flow].start}]${facts}` });
    await store(uid, 'event', FLOWS[flow].label, flow);
  } else {
    msgs.push({ role: 'user', content: userText });
    await store(uid, 'user', userText, null);
  }

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const m = await llm.chat(msgs, { tools: urgent ? [] : prefs.library.length ? [...tools.DEFS, LOOKUP] : tools.DEFS });
    if (m.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
      msgs.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
      for (const tc of m.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
        let result;
        try {
          if (tc.function.name === 'look_up_health_info') {
            const hits = prefs.library.length ? library.search(String(args.query || userText), prefs.library, { k: 3 }) : [];
            addSources(out, hits);
            result = hits.length ? { passages: hits.map((h) => ({ page: h.title, section: h.heading, text: h.text })) }
              : { found: false, note: 'Nothing in their chosen NHS pages covers this.' };
          } else result = await tools.run(uid, tc.function.name, args, out);
        }
        catch (e) { result = { error: 'tool failed' }; console.warn('[coach tool]', tc.function.name, e.message); }
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }
    out.reply = (m.content || '').trim() || 'I’m here. What would help most right now?';
    // Honesty check: the reply claims an action ("I've saved/added/set a reminder") that never happened.
    if (CLAIM.test(out.reply) && !out.actions.length && round < MAX_TOOL_ROUNDS && !out._rechecked) {
      out._rechecked = true;
      msgs.push({ role: 'assistant', content: out.reply });
      msgs.push({ role: 'user', content: '[System check: your last reply says you saved, added or set something, but no tool was called, so nothing was saved. Call the right tool now (propose_memory, save_commitment, add_to_inbox or add_goal_today) and then give a one-line confirmation. If nothing should be saved, correct yourself in one line.]' });
      continue;
    }
    break;
  }
  delete out._rechecked;
  await store(uid, 'assistant', out.reply, flow, out.sources);
  if (out.actions.some((a) => a.type === 'commitment' || a.type === 'inbox')) vault.syncPlans(uid).catch(() => {});
  return out;
}

/** Delete coach transcripts older than the retention window (default 60 days). */
async function purge() {
  const days = parseInt(process.env.COACH_RETENTION_DAYS || '60', 10);
  const { rowCount } = await pool.query(`DELETE FROM coach_messages WHERE created_at < NOW() - ($1 || ' days')::interval`, [String(days)]);
  if (rowCount) console.log(`[coach] purged ${rowCount} messages older than ${days} days`);
}

module.exports = { turn, purge, history, profileOf, FLOWS };
