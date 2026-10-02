/*
 * Side-rewards that hang off the core loop. Every function returns a list of short messages the
 * UI shows as toasts (e.g. "🐌 Shelly the snail joined you!"). All rewards are cosmetic.
 */
const { pool } = require('./db');
const game = require('./game');
const { COMPANIONS, EVENTS, activeEvent } = require('./catalog');
const { JOURNEYS } = require('./content');

const TOOL_ENERGY = 2;
const TOOL_REWARDS_PER_DAY = 3;
const MILESTONE_ACORNS = { 3: 5, 5: 10, 7: 20 };
const JOURNEY_ACORNS = 20;

async function grantCompanion(uid, id, source) {
  const { rowCount } = await pool.query(
    'INSERT INTO companions(user_id, companion, source) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [uid, id, source]);
  if (!rowCount) return [];
  const c = COMPANIONS.find((x) => x.id === id);
  return [`🎉 ${c ? c.name : id} joined you!`];
}

/** Monday of the week containing `day` (YYYY-MM-DD). */
function weekStart(day) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function onGoalCompleted(uid, goalId, day) {
  const out = [];
  const { rows: [g] } = await pool.query('SELECT category, journey_id FROM goals WHERE id=$1', [goalId]);
  if (!g) return out;

  // Seasonal event token
  const ev = activeEvent(day);
  if (ev) {
    const { rows: [t] } = await pool.query(
      `INSERT INTO event_tokens(user_id, event, tokens) VALUES ($1,$2,1)
       ON CONFLICT (user_id, event) DO UPDATE SET tokens = event_tokens.tokens + 1 RETURNING tokens`, [uid, ev.id]);
    out.push(`+1 ${ev.emoji} ${ev.token}`);
    if (t.tokens >= ev.companionAt) out.push(...await grantCompanion(uid, ev.companion, `event:${ev.id}`));
  }

  // Weekly category milestone: goals in this category on 3 / 5 / 7 distinct days this week
  const ws = weekStart(day);
  const { rows: [{ n }] } = await pool.query(
    `SELECT COUNT(DISTINCT c.day)::int n FROM goal_completions c JOIN goals g ON g.id=c.goal_id
     WHERE c.user_id=$1 AND NOT c.undone AND g.category=$2 AND c.day >= $3 AND c.day < ($3::date + 7)`,
    [uid, g.category, ws]);
  for (const level of [3, 5, 7]) {
    if (n < level) continue;
    const { rowCount } = await pool.query(
      'INSERT INTO milestones(user_id, week_start, category, level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [uid, ws, g.category, level]);
    if (rowCount) {
      await game.addAcorns(uid, MILESTONE_ACORNS[level], `milestone: ${g.category} ${level} days`);
      out.push(`🏅 ${g.category} on ${level} days this week! +${MILESTONE_ACORNS[level]} 🌰`);
      if (level === 7) out.push(...await grantCompanion(uid, 'ladybird', 'milestone'));
    }
  }

  // Journey: completing the final day finishes it
  if (g.journey_id) {
    const { rows: [j] } = await pool.query('SELECT * FROM journeys WHERE id=$1', [g.journey_id]);
    const def = j && JOURNEYS.find((x) => x.id === j.journey);
    if (j && def && !j.finished_at && j.step >= def.days.length) {
      const { rows: done } = await pool.query(
        `SELECT 1 FROM goals g JOIN goal_completions c ON c.goal_id=g.id AND NOT c.undone WHERE g.journey_id=$1`, [j.id]);
      if (done.length >= def.days.length) {
        await pool.query('UPDATE journeys SET finished_at=NOW() WHERE id=$1', [j.id]);
        await game.addAcorns(uid, JOURNEY_ACORNS, `journey: ${def.name}`);
        out.push(`${def.emoji} You finished “${def.name}”! +${JOURNEY_ACORNS} 🌰`);
        out.push(...await grantCompanion(uid, 'snail', `journey:${def.id}`));
      }
    }
  }
  return out;
}

/** Hand out today's journey task (once per day) for any active journey. */
async function issueJourneyGoals(uid, day) {
  const { rows } = await pool.query(
    `SELECT * FROM journeys WHERE user_id=$1 AND finished_at IS NULL AND abandoned_at IS NULL`, [uid]);
  for (const j of rows) {
    const def = JOURNEYS.find((x) => x.id === j.journey);
    if (!def || j.step >= def.days.length || (j.last_issued && j.last_issued >= day)) continue;
    const [title, category] = def.days[j.step];
    await pool.query(
      `INSERT INTO goals(user_id, title, category, days, once_on, why, source, journey_id)
       VALUES ($1,$2,$3,'{}',$4,$5,'suggestion',$6)`,
      [uid, title, category, day, `${def.emoji} ${def.name} — day ${j.step + 1} of ${def.days.length}`, j.id]);
    await pool.query('UPDATE journeys SET step=step+1, last_issued=$2 WHERE id=$1', [j.id, day]);
  }
}

/** Breathing / sounds / focus / stretches. Energy for the first few each day. */
async function onToolSession(uid, kind, detail, seconds) {
  const user = await game.getUser(uid);
  const day = game.localDay(user.tz);
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM tool_sessions WHERE user_id=$1 AND day=$2', [uid, day]);
  await pool.query('INSERT INTO tool_sessions(user_id, kind, detail, seconds, day) VALUES ($1,$2,$3,$4,$5)',
    [uid, kind, detail, Math.max(0, Math.min(7200, seconds | 0)), day]);
  const out = [];
  let energy = null;
  if (n < TOOL_REWARDS_PER_DAY) {
    energy = await game.addEnergy(uid, TOOL_ENERGY, kind);
    out.push(`+${TOOL_ENERGY} energy`);
  }
  if (kind === 'focus') {
    const { rows: [{ f }] } = await pool.query(`SELECT COUNT(*)::int f FROM tool_sessions WHERE user_id=$1 AND kind='focus'`, [uid]);
    if (f >= 10) out.push(...await grantCompanion(uid, 'firefly', 'focus'));
  }
  return { energy, messages: out };
}

async function onReflection(uid) {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM reflections WHERE user_id=$1 AND deleted_at IS NULL', [uid]);
  return n >= 10 ? grantCompanion(uid, 'mushroom', 'reflections') : [];
}

async function onKindnessSent(uid) {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM kindnesses WHERE from_user=$1', [uid]);
  return n >= 10 ? grantCompanion(uid, 'frog', 'kindness') : [];
}

async function onAdventureReturned(uid, adventuresNow) {
  return adventuresNow >= 20 ? grantCompanion(uid, 'pebble', 'adventures') : [];
}

module.exports = {
  grantCompanion, onGoalCompleted, issueJourneyGoals, onToolSession, onReflection, onKindnessSent,
  onAdventureReturned, weekStart, EVENTS,
};
