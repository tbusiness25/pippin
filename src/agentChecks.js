/*
 * Goals your agent ticks for you. A goal can carry a plain-English check ("Is my current account above £200?",
 * "Have I replied to everything in my inbox older than two days?", "Did I sleep 7 hours?"). Every so often the
 * agent looks it up with whatever tools YOU gave it — bank, email, calendar, wearables — and if it's true the
 * goal is ticked, with the usual energy for the sprig.
 *
 * No-shame rules: a "not yet" is silent — no nudge, no red mark. Only good news is pushed. Checks are read-only
 * by instruction, the agent's answer is stored encrypted, and nothing runs unless an agent brain is configured.
 */
const { pool } = require('./db');
const game = require('./game');
const { completeGoal } = require('./goalDone');
const { encrypt, decrypt } = require('./coach/crypto');

const EVERY_MIN = Math.max(15, parseInt(process.env.AGENT_CHECK_EVERY_MIN || '60', 10));
const PER_TICK = 4;
let brain = null;
let running = false;
const inFlight = new Set();   // goal ids being checked right now (timer and "Check now" must not overlap)

const available = () => !!(brain && typeof brain.check === 'function');

async function runCheck(user, goal) {
  if (inFlight.has(goal.id)) return { met: null, evidence: 'already checking' };
  inFlight.add(goal.id);
  try { return await doCheck(user, goal); } finally { inFlight.delete(goal.id); }
}

async function doCheck(user, goal) {
  const today = game.localDay(user.tz);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: user.tz, hour: '2-digit', minute: '2-digit' }).format(new Date());
  let r;
  try { r = await Promise.race([brain.check(goal.agent_check, { today, time }), new Promise((_, rej) => setTimeout(() => rej(new Error("took too long")), 6 * 60000))]); }
  catch (e) { r = { met: null, evidence: `Couldn't check: ${e.message}`.slice(0, 140) }; }
  await pool.query('INSERT INTO goal_checks(goal_id, user_id, day, met, evidence_enc) VALUES ($1,$2,$3,$4,$5)',
    [goal.id, user.id, today, r.met, r.evidence ? encrypt(r.evidence) : null]);
  if (r.met === true) {
    const done = await completeGoal(user.id, goal.id, today);
    if (done.first) {
      require('./push').notify(user.id, 'agent-tick', `✅ ${goal.title} — done, your assistant checked.`, { ref: `agent:${goal.id}:${today}`, url: '/#goals' }).catch(() => {});
    }
  }
  return r;
}

// Goals due today, not done yet, with a check whose last attempt is older than EVERY_MIN.
async function due(limit) {
  const { rows } = await pool.query(
    `SELECT g.id, g.title, g.agent_check, g.agent_check_after, g.days, g.once_on, u.id AS uid, u.tz
       FROM goals g JOIN users u ON u.id = g.user_id AND u.deleted_at IS NULL
      WHERE g.agent_check IS NOT NULL AND g.deleted_at IS NULL`);
  const out = [];
  for (const g of rows) {
    const today = game.localDay(g.tz);
    const scheduled = g.once_on ? String(g.once_on).slice(0, 10) === today : g.days.includes(game.localWeekday(g.tz));
    if (!scheduled) continue;
    if (g.agent_check_after) {
      const now = new Intl.DateTimeFormat('en-GB', { timeZone: g.tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      if (now < g.agent_check_after.slice(0, 5)) continue;
    }
    const { rows: [state] } = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM goal_completions WHERE goal_id=$1 AND day=$2 AND NOT undone) AS done,
              (SELECT MAX(checked_at) FROM goal_checks WHERE goal_id=$1 AND day=$2) AS last`, [g.id, today]);
    if (state.done || inFlight.has(g.id)) continue;
    if (state.last && Date.now() - new Date(state.last) < EVERY_MIN * 60000) continue;
    out.push(g);
    if (out.length >= limit) break;
  }
  return out;
}

async function tick() {
  if (!available() || running) return;
  running = true;
  try {
    for (const g of await due(PER_TICK)) await runCheck({ id: g.uid, tz: g.tz }, g);   // one at a time: agents are slow
  } catch (e) { console.error('[agent-checks]', e.message); }
  finally { running = false; }
}

function checkNow(uid, goalId) {
  (async () => {
    const { rows: [g] } = await pool.query('SELECT id, title, agent_check FROM goals WHERE id=$1 AND user_id=$2', [goalId, uid]);
    const user = await game.getUser(uid);
    if (g && user) await runCheck(user, g);
  })().catch((e) => console.error('[agent-checks] now:', e.message));
}

// Today's latest check per goal, for the goals screen.
async function lastChecks(uid) {
  const user = await game.getUser(uid);
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (goal_id) goal_id, met, evidence_enc, checked_at FROM goal_checks
      WHERE user_id=$1 AND day=$2 ORDER BY goal_id, checked_at DESC`, [uid, game.localDay(user.tz)]);
  const out = {};
  for (const r of rows) {
    let evidence = null; try { evidence = r.evidence_enc ? decrypt(r.evidence_enc) : null; } catch (_) {}
    out[r.goal_id] = { met: r.met, evidence, checked_at: r.checked_at };
  }
  return out;
}

function start(b) {
  brain = b;
  if (!available()) return;
  setTimeout(tick, 30000);
  setInterval(tick, 5 * 60 * 1000);
  console.log(`[agent-checks] on — every ${EVERY_MIN} min per goal`);
}

module.exports = { start, available, checkNow, lastChecks, runCheck };
