const express = require('express');
const { pool } = require('../db');
const game = require('../game');
const rewards = require('../rewards');
const { COMPANIONS, activeEvent } = require('../catalog');

module.exports = (brain) => {
  const router = express.Router();

  const COLOURS = ['moss', 'sky', 'peach', 'lilac', 'sun', 'rose'];
  const TRAITS = ['curious', 'gentle', 'brave', 'silly', 'thoughtful', 'sleepy', 'chatty', 'creative'];

  // Everything the home screen needs in one call.
  router.get('/state', async (req, res) => {
    const user = await game.getUser(req.uid);
    const pet = await game.getPet(req.uid);
    const today = game.localDay(user.tz);
    const weekday = game.localWeekday(user.tz);
    await rewards.issueJourneyGoals(req.uid, today);
    let petOut = null;
    if (pet) {
      const stage = game.stageFor(pet.adventures);
      const next = game.STAGES[game.STAGES.indexOf(stage) + 1];
      const adv = await game.currentAdventure(pet.id);
      petOut = {
        id: pet.id, name: pet.name, pronouns: pet.pronouns, colour: pet.colour, traits: pet.traits,
        acorns: pet.acorns, adventures: pet.adventures, equipped: pet.equipped, home: pet.home,
        energy: pet.energy_day === today ? pet.energy : 0, energyCap: stage.energyCap,
        stage: { key: stage.key, name: stage.name, next: next ? { name: next.name, at: next.from } : null },
        adventure: adv && {
          id: adv.id, place: adv.place, endsAt: adv.ends_at,
          status: new Date(adv.ends_at) <= new Date() ? 'home' : 'away',
        },
      };
    }
    const { rows: goals } = await pool.query(`
      SELECT g.id, g.title, g.category, g.steps, g.why, g.source, g.once_on, g.shared_id,
             (c.id IS NOT NULL AND NOT c.undone) AS done,
             (SELECT json_agg(json_build_object('name', u.name, 'done', (oc.id IS NOT NULL AND NOT oc.undone)))
                FROM goals og JOIN users u ON u.id = og.user_id
                LEFT JOIN goal_completions oc ON oc.goal_id = og.id AND oc.day = $2
               WHERE g.shared_id IS NOT NULL AND og.shared_id = g.shared_id AND og.user_id <> g.user_id
                 AND og.deleted_at IS NULL) AS partners
      FROM goals g LEFT JOIN goal_completions c ON c.goal_id=g.id AND c.day=$2
      WHERE g.user_id=$1 AND g.deleted_at IS NULL
        AND ((g.once_on IS NULL AND $3 = ANY(g.days)) OR g.once_on = $2)
      ORDER BY done, g.sort, g.created_at`, [req.uid, today, weekday]);
    const { rows: comps } = await pool.query('SELECT companion FROM companions WHERE user_id=$1 ORDER BY acquired_at', [req.uid]);
    const ev = activeEvent(today);
    const { rows: tok } = ev ? await pool.query('SELECT tokens FROM event_tokens WHERE user_id=$1 AND event=$2', [req.uid, ev.id]) : { rows: [] };
    const { rows: kind } = await pool.query(
      `SELECT k.id, k.kind, u.name AS from_name FROM kindnesses k JOIN users u ON u.id = k.from_user
       WHERE k.to_user=$1 AND k.seen_at IS NULL ORDER BY k.created_at`, [req.uid]);
    const { rows: [act] } = await pool.query(
      `SELECT ($2::date - MAX(day))::int ago FROM (SELECT day FROM checkins WHERE user_id=$1 AND day < $2
         UNION SELECT day FROM goal_completions WHERE user_id=$1 AND day < $2) x`, [req.uid, today]);
    const { rows: plans } = await pool.query(
      `SELECT id, what, when_text, due_at FROM commitments WHERE user_id=$1 AND status='open' ORDER BY due_at NULLS LAST, created_at LIMIT 5`, [req.uid]);
    const { rows: trackers } = await pool.query(`
      SELECT t.id, t.label, t.category, t.discreet, t.start_date::text sd,
        (SELECT COUNT(*) FROM tracker_days d WHERE d.tracker_id=t.id AND d.status='free')::int free,
        (SELECT status FROM tracker_days d WHERE d.tracker_id=t.id AND d.day=$2) today_status
      FROM trackers t WHERE t.user_id=$1 AND t.archived_at IS NULL ORDER BY t.created_at`, [req.uid, today]);
    const { rows: habitsToday } = await pool.query(`
      SELECT h.id, h.title, h.tiny, (SELECT status FROM habit_logs l WHERE l.habit_id=h.id AND l.day=$2) today
      FROM habits h WHERE h.user_id=$1 AND h.status='building' ORDER BY h.sort, h.created_at`, [req.uid, today]);
    const { rows: [inbox] } = await pool.query(`SELECT COUNT(*)::int n FROM inbox_items WHERE user_id=$1 AND status='open'`, [req.uid]);
    const { rows: checkins } = await pool.query(
      'SELECT kind, mood, energy FROM checkins WHERE user_id=$1 AND day=$2', [req.uid, today]);
    res.json({
      ok: true, today,
      user: { name: user.name, settings: user.settings },
      pet: petOut, goals,
      checkins: { morning: checkins.find((c) => c.kind === 'morning') || null,
                  evening: checkins.find((c) => c.kind === 'evening') || null },
      streak: await game.streak(req.uid),
      brain: { name: brain.name, label: brain.label, capabilities: brain.capabilities },
      companions: comps.map((c) => COMPANIONS.find((x) => x.id === c.companion)).filter(Boolean),
      event: ev && { ...ev, tokens: tok[0]?.tokens || 0 },
      kindnesses: kind,
      isOwner: user.is_owner,
      lastActiveDaysAgo: act?.ago ?? null,
      plans, inboxCount: inbox.n, trackers, habitsToday,
      checksDue: (await require('./tools').checksDue(req.uid)).checks.filter((c) => c.due),
      options: { colours: COLOURS, traits: TRAITS },
    });
  });

  router.post('/hatch', async (req, res) => {
    const { name, pronouns, colour, trait } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ ok: false, error: 'Give your sprig a name' });
    if (await game.getPet(req.uid)) return res.status(409).json({ ok: false, error: 'You already have a sprig' });
    await pool.query(
      'INSERT INTO pets(user_id, name, pronouns, colour, traits) VALUES ($1,$2,$3,$4,$5)',
      [req.uid, String(name).trim().slice(0, 24), pronouns || 'they/them',
        COLOURS.includes(colour) ? colour : 'moss', TRAITS.includes(trait) ? [trait] : ['curious']]);
    res.json({ ok: true });
  });

  // Welcome the sprig home: write its story, pay acorns, count the adventure, maybe grow.
  router.post('/adventure/return', async (req, res) => {
    const pet = await game.getPet(req.uid);
    const adv = pet && await game.currentAdventure(pet.id);
    if (!adv || new Date(adv.ends_at) > new Date()) return res.status(400).json({ ok: false, error: 'Not home yet' });
    const before = game.stageFor(pet.adventures);
    const story = await brain.story({
      petName: pet.name, pronouns: pet.pronouns, stage: before.name, place: adv.place, traits: pet.traits,
    });
    const streak = await game.streak(req.uid);
    const bonus = streak.enabled && streak.days ? Math.min(10, Math.floor(streak.days / 5)) : 0;
    const acorns = game.ACORNS_PER_ADVENTURE + bonus;
    await pool.query('UPDATE adventures SET returned_at=NOW(), story=$2, acorns=$3 WHERE id=$1', [adv.id, story, acorns]);
    await pool.query('UPDATE pets SET adventures = adventures + 1 WHERE id=$1', [pet.id]);
    await game.addAcorns(req.uid, acorns, `adventure: ${adv.place}`);
    const after = game.stageFor(pet.adventures + 1);
    const messages = await rewards.onAdventureReturned(req.uid, pet.adventures + 1);
    res.json({ ok: true, place: adv.place, story, acorns, streakBonus: bonus, messages,
      grew: after.key !== before.key ? after.name : null });
  });

  router.get('/adventures', async (req, res) => {
    const pet = await game.getPet(req.uid);
    if (!pet) return res.json({ ok: true, adventures: [] });
    const { rows } = await pool.query(
      `SELECT place, started_at, returned_at, story, acorns FROM adventures
       WHERE pet_id=$1 AND returned_at IS NOT NULL ORDER BY returned_at DESC LIMIT 50`, [pet.id]);
    res.json({ ok: true, adventures: rows });
  });

  return router;
};
