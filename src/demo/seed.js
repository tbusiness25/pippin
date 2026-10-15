/*
 * Demo data: a made-up household — Sam and Alex (parents) and Pip (8) — with about two months of history in
 * every part of the app. Wipes ALL user data first. Only runs when DEMO_MODE=true.
 */
const fs = require('fs');
const path = require('path');
const { hashPin } = require('../auth');
const crypto = require('../coach/crypto');

// deterministic pseudo-random, so the demo looks the same after every reset
let seed = 20261014;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
const daysAgo = (n) => { const d = new Date(Date.now() - n * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d); };
const at = (n, hh = 9, mm = 0) => new Date(`${daysAgo(n)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);

async function wipe(q) {
  await q(`TRUNCATE users CASCADE`);
}

async function run(pool) {
  if (process.env.DEMO_MODE !== 'true') throw new Error('refusing: DEMO_MODE is not on');
  seed = 20261014;
  const q = (sql, p) => pool.query(sql, p);
  await wipe(q);
  const pin = await hashPin('1234');
  const mk = async (name, slug, role, extra = {}) => (await q(`INSERT INTO users(name, pin_hash, tz, settings, is_owner, role, is_parent, slug, created_at)
    VALUES ($1,$2,'Europe/London',$3,$4,$5,$6,$7, NOW() - interval '75 days') RETURNING id`,
  [name, pin, JSON.stringify({ streaks_enabled: true, streak_level: 'gentle', nudges: false, ...extra.settings }), !!extra.owner, role, role === 'adult', slug])).rows[0].id;
  const sam = await mk('Sam', 'sam', 'adult', { owner: true });
  const alex = await mk('Alex', 'alex', 'adult');
  const pip = await mk('Pip', 'pip', 'child', { settings: { kids: { age: 8, about: 'Loves dinosaurs, Lego and football', traits: ['curious', 'silly'], favs: ['dinosaurs', 'Lego', 'football'] } } });

  // ---------------- sprigs
  for (const [uid, name, colour, trait, acorns] of [[sam, 'Moss', 'moss', 'curious', 340], [alex, 'Fern', 'sky', 'gentle', 210], [pip, 'Rex', 'sun', 'silly', 120]]) {
    await q(`INSERT INTO pets(user_id, name, pronouns, colour, traits, energy, energy_day, acorns, adventures, hatched_at) VALUES ($1,$2,'they/them',$3,$4,$5,CURRENT_DATE,$6,$7, NOW() - interval '70 days')`,
      [uid, name, colour, [trait], between(40, 85), acorns, between(4, 14)]);
  }

  // ---------------- Sam: check-ins, goals, habits, reflections
  const good = ['calm', 'happy', 'proud', 'hopeful', 'grateful', 'focused', 'loved', 'energised'];
  const hard = ['tired', 'anxious', 'overwhelmed', 'sad', 'frustrated', 'scattered'];
  const notes = ['Slept badly, school run chaos', 'Good focus this morning', 'Long meeting day', 'Walked at lunch, helped', 'Pip had a meltdown at bedtime', 'Felt on top of things', 'Too much coffee', 'Nice evening with Alex', ''];
  for (const uid of [sam, alex]) {
    for (let n = 60; n >= 0; n--) {
      if (rnd() < 0.15) continue;
      const trend = 3 + (60 - n) / 60 * 0.8;
      for (const kind of ['morning', 'evening']) {
        if (kind === 'evening' && rnd() < 0.3) continue;
        const mood = Math.max(1, Math.min(5, Math.round(trend + (rnd() - 0.5) * 2.2)));
        const emo = mood >= 4 ? [pick(good), pick(good)] : mood <= 2 ? [pick(hard), pick(hard)] : [pick(good), pick(hard)];
        await q(`INSERT INTO checkins(user_id, kind, day, mood, energy, emotions, note, gratitude, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [uid, kind, daysAgo(n), mood, Math.max(1, Math.min(5, mood + between(-1, 1))), [...new Set(emo)], uid === sam && rnd() < 0.3 ? pick(notes) || null : null,
            kind === 'evening' && rnd() < 0.5 ? pick(['Pip’s drawing', 'Sunshine at lunch', 'Alex made dinner', 'Finished the report', 'A long bath']) : null, at(n, kind === 'morning' ? 7 : 21)]);
      }
    }
  }
  const goals = [['Drink a glass of water first thing', 'body'], ['10-minute walk outside', 'body'], ['Clear the kitchen before bed', 'home'], ['Inbox to zero (or close)', 'work'], ['Text a friend', 'people']];
  for (const [i, [title, cat]] of goals.entries()) {
    const { rows: [g] } = await q(`INSERT INTO goals(user_id, title, category, days, steps, source, sort, created_at) VALUES ($1,$2,$3,$4,'[]','user',$5, NOW() - interval '60 days') RETURNING id`, [sam, title, cat, [0, 1, 2, 3, 4, 5, 6], i]);
    for (let n = 45; n >= 1; n--) if (rnd() < 0.62 + i * -0.05) await q(`INSERT INTO goal_completions(goal_id, user_id, day, completed_at) VALUES ($1,$2,$3,$4)`, [g.id, sam, daysAgo(n), at(n, 12)]);
  }
  const habits = [['Stretch for 2 minutes', 'After I put the kettle on', 'One stretch', 7], ['Read 10 pages', 'After Pip is in bed', 'One page', 5], ['Phone in the drawer at 10pm', 'When the news ends', 'Turn it face down', 7]];
  for (const [i, [title, anchor, tiny, perWeek]] of habits.entries()) {
    const { rows: [h] } = await q(`INSERT INTO habits(user_id, title, anchor, tiny, per_week, status, sort, created_at) VALUES ($1,$2,$3,$4,$5,'building',$6, NOW() - interval '40 days') RETURNING id`, [sam, title, anchor, tiny, perWeek, i]);
    for (let n = 38; n >= 1; n--) { const r = rnd(); if (r < 0.55) await q(`INSERT INTO habit_logs(habit_id, user_id, day, status) VALUES ($1,$2,$3,$4)`, [h.id, sam, daysAgo(n), r < 0.12 ? 'mini' : 'done']); }
  }
  for (const [n, prompt, body] of [[3, 'What went well this week?', 'Got Pip to swimming on time every day. Small thing but it felt like a win.'],
    [10, 'What drained you?', 'Back-to-back calls with no breaks. Need to block lunch in the diary.'],
    [17, 'What would make tomorrow easier?', 'Packing bags the night before. Every time I do it the morning is calmer.'],
    [25, 'Something you’re proud of', 'Said no to the extra project without over-explaining.']]) {
    await q(`INSERT INTO reflections(user_id, prompt, body, tags, day, created_at) VALUES ($1,$2,$3,'{}',$4,$5)`, [sam, prompt, body, daysAgo(n), at(n, 21)]);
  }
  for (const [what, when, n, status] of [['Book the dentist for Pip', 'this week', -3, 'open'], ['Call the council about the bins', 'Friday', 2, 'done'], ['Renew the car insurance', 'before the 20th', -9, 'open']]) {
    await q(`INSERT INTO commitments(user_id, what, when_text, due_at, status, source, created_at) VALUES ($1,$2,$3,$4,$5,'coach',$6)`, [sam, what, when, at(n, 17), status, at(Math.abs(n) + 4, 9)]);
  }
  for (const [text, n] of [['Birthday present for Jo', 6], ['Sign Pip’s school trip form', 2], ['Order more printer ink', 1], ['Look at summer holiday dates', 12]]) {
    await q(`INSERT INTO inbox_items(user_id, text, due_on, status, created_at) VALUES ($1,$2,$3,'open',$4)`, [sam, text, daysAgo(-n), at(3, 10)]);
  }
  for (const [n, kind, secs] of [[1, 'breathe', 180], [2, 'focus', 1500], [4, 'focus', 1500], [5, 'stretch', 300], [8, 'breathe', 240], [9, 'sounds', 1800]]) {
    await q(`INSERT INTO tool_sessions(user_id, kind, seconds, day, created_at) VALUES ($1,$2,$3,$4,$5)`, [sam, kind, secs, daysAgo(n), at(n, 14)]);
  }
  for (const [n, score] of [[58, 9], [30, 7], [2, 5]]) await q(`INSERT INTO quiz_results(user_id, quiz, score, answers, created_at) VALUES ($1,'gad7',$2,$3,$4)`, [sam, score, [1, 1, 1, 1, 1, 0, 0].map((x, i) => (i < score % 7 ? 1 : 0) + (score > 7 && i < 2 ? 1 : 0)), at(n, 20)]);

  // ---------------- Sam: alcohol-free tracker (day 47)
  const { rows: [tr] } = await q(`INSERT INTO trackers(user_id, category, label, goal, start_date, target_days, baseline, reasons, show_run, screening, discreet, created_at)
    VALUES ($1,'alcohol','Alcohol-free','quit',$2,365,$3,$4,true,$5,true, NOW() - interval '47 days') RETURNING id`,
  [sam, daysAgo(47), JSON.stringify({ spend: 45, units: 18 }), ['Sleep better', 'Be present with Pip', 'Save up'], JSON.stringify({ gate: 'ok', acknowledged_at: new Date().toISOString() })]);
  for (let n = 47; n >= 1; n--) await q(`INSERT INTO tracker_days(tracker_id, user_id, day, status, pledged) VALUES ($1,$2,$3,$4,$5)`, [tr.id, sam, daysAgo(n), n === 19 ? 'lapse' : 'free', rnd() < 0.6]);
  await q(`INSERT INTO lapses(tracker_id, user_id, day, amount, situation, what_happened, next_24h, next_time) VALUES ($1,$2,$3,4,$4,$5,$6,$7)`,
    [tr.id, sam, daysAgo(19), ['wedding', 'others drinking'], 'Friend’s wedding — had two glasses of fizz during the toasts.', 'Water and an early night.', 'Bring my own alcohol-free bottle and a reason ready.']);

  // ---------------- Sam: people (no real contacts)
  for (const [name, ring, sentAgo] of [['Alex', 'closest', 0], ['Mum', 'closest', 4], ['Jo', 'close', 12], ['Priya', 'close', 30], ['Dan (football)', 'friends', 44], ['Uncle Ray', 'wider', 120]]) {
    await q(`INSERT INTO people(user_id, name, ring, cadence_days, last_sent_at, last_received_at, created_at) VALUES ($1,$2,$3,$4,$5,$6, NOW() - interval '60 days')`,
      [sam, name, ring, { closest: 7, close: 21, friends: 60, wider: 180 }[ring], at(sentAgo, 18), at(sentAgo + 2, 19)]);
  }

  // ---------------- Sam: coach + chat history (encrypted like real ones)
  const coach = [['user', 'Morning. Didn’t sleep great and today’s packed.'], ['assistant', 'That’s a rough combination. What’s the one thing that has to happen today — and what can wait until tomorrow?'],
    ['user', 'The client report has to go. The rest can wait.'], ['assistant', 'Then let’s protect that. When will you start it, and what’s the very first step — opening the doc counts.'],
    ['user', 'After the school run, 9:15. First step: open last month’s report.'], ['assistant', 'Saved: “Open last month’s report at 9:15.” If the morning slips, the backup is 1:30 after lunch. I’ll keep the rest of today light.']];
  for (const [i, [role, text]] of coach.entries()) await q(`INSERT INTO coach_messages(user_id, role, body_enc, flow, created_at) VALUES ($1,$2,$3,'morning',$4)`, [sam, role, crypto.encrypt(text), at(1, 8, i * 2)]);
  const { rows: [th] } = await q(`INSERT INTO chat_threads(user_id, title, created_at, updated_at) VALUES ($1,'Rainy-day activities for an 8-year-old',$2,$2) RETURNING id`, [sam, at(4, 19)]);
  for (const [i, [role, text]] of [['user', 'Ideas for a rainy Saturday with an 8-year-old who loves dinosaurs?'], ['assistant', 'A few that work well:\n\n- **Dinosaur dig**: bury plastic dinosaurs in a tray of flour or sand with a paintbrush for “excavating”.\n- **Natural History Museum**: free, and the dinosaur gallery is a guaranteed hit (book a slot at weekends).\n- **Build a Lego dino** from what you already have, then make it a cardboard habitat.\n- **Fossil biscuits**: press dinosaur footprints into biscuit dough before baking.']].entries()) {
    await q(`INSERT INTO coach_messages(user_id, role, body_enc, flow, created_at, thread_id) VALUES ($1,$2,$3,'chat',$4,$5)`, [sam, role, crypto.encrypt(text), at(4, 19, i), th.id]);
  }

  // ---------------- household: calendar
  for (const [title, n, notes] of [['Pip — swimming lesson', -2, null], ['Parents’ evening', -6, '5:40pm, Mrs Green'], ['Bin day (recycling)', -1, null], ['Grandma visiting', -11, 'Staying Saturday night'], ['Half-term starts', -15, null], ['Car MOT', -20, '8:30 drop-off']]) {
    await q(`INSERT INTO family_calendar_events(title, starts_on, all_day, notes, created_by, source) VALUES ($1,$2,true,$3,$4,'pippin')`, [title, daysAgo(n), notes, sam]);
  }

  // ---------------- Pip: chores, stars, rewards, pocket money
  try {
    const chores = require('../kids/chores'); const stars = require('../kids/stars'); const money = require('../kids/money');
    await chores.seedChores(pool, pip); await stars.seedRewards(pool, pip); await money.seedPots(pool, pip);
    const { rows: list } = await q('SELECT id, star_value FROM kid_chores WHERE child_id=$1', [pip]);
    for (let n = 20; n >= 1; n--) for (const c of list) if (rnd() < 0.55) {
      await q(`INSERT INTO kid_chore_completions(child_id, chore_id, completed_date, completed_at, stars_awarded) VALUES ($1,$2,$3,$4,$5)`, [pip, c.id, daysAgo(n), at(n, 8), c.star_value]);
      await stars.addStars(pool, pip, { source: 'chore', ref: `${c.id}:${n}`, stars: c.star_value, note: 'Chore' });
    }
    for (let w = 6; w >= 1; w--) await money.creditIn(pool, pip, { pence: 500, source: 'allowance', ref: `demo-w${w}`, note: 'Pocket money' }).catch(() => {});
    for (const [title, note] of [['Lego Jurassic World T. rex set', 'For my birthday!'], ['Football boots (size 1)', null], ['Glow-in-the-dark dinosaur stickers', null]]) {
      await q(`INSERT INTO kid_wishlist_items(child_id, title, note) VALUES ($1,$2,$3)`, [pip, title, note]);
    }
  } catch (e) { console.warn('[demo] kids seed', e.message); }

  return { sam, alex, pip };
}

module.exports = { run };
