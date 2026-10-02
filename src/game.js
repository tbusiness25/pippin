/*
 * Pippin game rules — the whole progression lives here so it's easy to read and tune.
 *
 * Loop: small self-care actions give the sprig ENERGY. When the day's energy bar is full the
 * sprig goes on an ADVENTURE (real time). When it comes home it brings a story, a discovery
 * and ACORNS (cosmetic-only currency). Completed adventures make it GROW through stages.
 *
 * Kindness rules (non-negotiable, see docs/DESIGN.md):
 *  - Nothing ever decays. The sprig never gets sad, sick or smaller because you were away.
 *  - Streaks are optional, can be paused, and a missed stretch of up to 3 days can be repaired.
 *  - Acorns buy cosmetics only. No self-care tool is ever locked behind them.
 */
const { pool } = require('./db');

const STAGES = [
  { key: 'seedling', name: 'Seedling', energyCap: 15, adventureHours: 6, from: 0 },
  { key: 'sprout',   name: 'Sprout',   energyCap: 20, adventureHours: 7, from: 10 },
  { key: 'sapling',  name: 'Sapling',  energyCap: 25, adventureHours: 8, from: 25 },
  { key: 'bloom',    name: 'Bloom',    energyCap: 30, adventureHours: 8, from: 45 },
  { key: 'elder',    name: 'Elder',    energyCap: 30, adventureHours: 8, from: 70 },
];

const ENERGY = { goal: 5, morningCheckin: 5, eveningCheckin: 5 };
const MINUTES_OFF_PER_GOAL_WHILE_AWAY = 10;
const ACORNS_PER_ADVENTURE = 10;
const MAX_REPAIR_GAP_DAYS = 3;

const PLACES = [
  'the Mossy Hollow', 'the Lantern Market', 'Whistling Reeds', 'the Old Library Stump',
  'Puddle Harbour', 'the Fern Tunnels', 'Cloudberry Hill', 'the Quiet Pond', 'Snail Post Office',
  'the Mushroom Ring', 'Driftwood Beach', 'the Night Garden',
];

const stageFor = (adventures) => [...STAGES].reverse().find((s) => adventures >= s.from);

/** Today's date (YYYY-MM-DD) in the user's timezone. */
function localDay(tz, d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/London' }).format(d);
}
function localWeekday(tz, d = new Date()) {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/London', weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

async function getUser(uid) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [uid]);
  return rows[0];
}
async function getPet(uid) {
  const { rows } = await pool.query('SELECT * FROM pets WHERE user_id=$1 AND deleted_at IS NULL', [uid]);
  return rows[0] || null;
}
async function currentAdventure(petId) {
  const { rows } = await pool.query(
    'SELECT * FROM adventures WHERE pet_id=$1 AND returned_at IS NULL ORDER BY started_at DESC LIMIT 1', [petId]);
  return rows[0] || null;
}

/**
 * Give the sprig energy. Energy resets at the start of each local day. While the sprig is away,
 * energy instead shortens the trip. Returns {energy, cap, started: adventure|null, shortenedBy}.
 */
async function addEnergy(uid, amount, reason) {
  const user = await getUser(uid);
  const pet = await getPet(uid);
  if (!pet) return null;
  const today = localDay(user.tz);
  const stage = stageFor(pet.adventures);
  const away = await currentAdventure(pet.id);

  if (away && new Date(away.ends_at) > new Date()) {
    const mins = Math.round((amount / ENERGY.goal) * MINUTES_OFF_PER_GOAL_WHILE_AWAY);
    await pool.query(`UPDATE adventures SET ends_at = GREATEST(NOW(), ends_at - ($2 || ' minutes')::interval) WHERE id=$1`,
      [away.id, String(mins)]);
    return { energy: pet.energy, cap: stage.energyCap, away: true, shortenedBy: mins, reason };
  }

  let energy = pet.energy_day && localDayOf(pet.energy_day) === today ? pet.energy : 0;
  energy = Math.min(stage.energyCap, energy + amount);
  await pool.query('UPDATE pets SET energy=$2, energy_day=$3 WHERE id=$1', [pet.id, energy, today]);

  let started = null;
  if (energy >= stage.energyCap && !away) {
    const place = PLACES[Math.floor(Math.random() * PLACES.length)];
    const { rows } = await pool.query(
      `INSERT INTO adventures(pet_id, ends_at, place) VALUES ($1, NOW() + ($2 || ' hours')::interval, $3) RETURNING *`,
      [pet.id, String(stage.adventureHours), place]);
    started = rows[0];
    await pool.query('UPDATE pets SET energy=0 WHERE id=$1', [pet.id]);
    energy = 0;
  }
  return { energy, cap: stage.energyCap, started, reason };
}

const localDayOf = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// The person's chosen daily aim: how many self-care actions (goals + check-ins) make a streak day.
const STREAK_LEVELS = { gentle: 1, steady: 2, keen: 3, blazing: 4 };

/**
 * A streak day = at least the aimed-for number of actions (goals completed + check-ins), or a
 * repaired day. Paused days are skipped (neither break nor extend the streak).
 */
async function streak(uid) {
  const user = await getUser(uid);
  const s = user.settings || {};
  if (s.streaks_enabled === false) return { enabled: false };
  const need = STREAK_LEVELS[s.streak_level] || 1;
  const { rows } = await pool.query(`
    SELECT day::text FROM (
      SELECT day FROM goal_completions WHERE user_id=$1 AND NOT undone
      UNION ALL SELECT day FROM checkins WHERE user_id=$1) a
    GROUP BY day HAVING COUNT(*) >= $2
    UNION SELECT day::text FROM streak_events WHERE user_id=$1 AND kind='repair'`, [uid, need]);
  const active = new Set(rows.map((r) => r.day));
  const today = localDay(user.tz);
  let count = 0;
  let cursor = new Date(today + 'T12:00:00Z');
  if (!active.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);   // today not done yet ≠ broken
  const paused = s.paused_from ? s.paused_from : null;
  for (;;) {
    const d = cursor.toISOString().slice(0, 10);
    if (active.has(d)) count++;
    else if (!(paused && d >= paused)) break;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // A repairable gap: the streak before a short gap is still there to be mended.
  let repairable = null;
  if (!active.has(today)) {
    const gap = [];
    const c = new Date(today + 'T12:00:00Z');
    c.setUTCDate(c.getUTCDate() - 1);
    while (gap.length <= MAX_REPAIR_GAP_DAYS && !active.has(c.toISOString().slice(0, 10))) {
      gap.push(c.toISOString().slice(0, 10));
      c.setUTCDate(c.getUTCDate() - 1);
    }
    if (gap.length >= 1 && gap.length <= MAX_REPAIR_GAP_DAYS && active.has(c.toISOString().slice(0, 10))) {
      repairable = { days: gap, cost: await repairCost(uid) };
    }
  }
  return { enabled: true, days: count, paused: !!paused, repairable, level: s.streak_level || 'gentle' };
}

/** First repair each calendar month is free; after that it costs a few acorns. */
async function repairCost(uid) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT created_at::date) n FROM streak_events
     WHERE user_id=$1 AND kind='repair' AND created_at >= date_trunc('month', NOW())`, [uid]);
  return Number(rows[0].n) === 0 ? 0 : 15;
}

async function addAcorns(uid, delta, reason) {
  await pool.query('UPDATE pets SET acorns = acorns + $2 WHERE user_id=$1 AND deleted_at IS NULL', [uid, delta]);
  await pool.query('INSERT INTO acorn_ledger(user_id, delta, reason) VALUES ($1,$2,$3)', [uid, delta, reason]);
}

module.exports = {
  STAGES, ENERGY, PLACES, ACORNS_PER_ADVENTURE, stageFor, localDay, localWeekday,
  getUser, getPet, currentAdventure, addEnergy, streak, repairCost, addAcorns,
};
