/*
 * ✅ My jobs — a child's daily responsibilities, plus the weekly plan ("what am I doing after school?").
 * The child ticks jobs and plans; parents edit jobs and the time rules (in the Family section).
 *   /api/kids/jobs…   (child, or a parent with ?child=)
 */
const { pool } = require('../db');
const util = require('./util');
const { DEFAULT_JOBS, CATEGORIES, ICON, BANK, GUIDE, GUIDE_PARENTS } = require('./jobs_data');

const tzOf = (kid) => kid.tz || process.env.TZ_DEFAULT || 'Europe/London';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();          // 0 Sun … 6 Sat
const isSchoolDay = (day) => { const w = weekdayOf(day); return w >= 1 && w <= 5; };
const mondayOf = (day) => { const w = (weekdayOf(day) + 6) % 7; return new Date(Date.parse(`${day}T12:00:00Z`) - w * 86400000).toISOString().slice(0, 10); };
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayFor = (req, kid) => (DAY.test(req.query.day || '') ? req.query.day : util.localDate(tzOf(kid)));
const str = (v, n) => (v == null ? null : String(v).slice(0, n));

async function seedJobs(pool, kid) {
  const s = (kid.settings || {}).kids || {};
  if (s.jobs_seeded) return;
  const { rows: [c] } = await pool.query('SELECT COUNT(*)::int n FROM kid_jobs WHERE child_id=$1', [kid.id]);
  if (!c.n) for (const j of DEFAULT_JOBS) await pool.query(`INSERT INTO kid_jobs(child_id, title, detail, icon, slot, days, timer_secs, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [kid.id, j.title, j.detail, j.icon, j.slot, j.days, j.timer || null, j.sort]);
  await pool.query(`UPDATE users SET settings = jsonb_set(settings, '{kids,jobs_seeded}', 'true'::jsonb, true) WHERE id=$1`, [kid.id]);
}

const jobDue = (j, day) => j.days === 'daily' || (j.days === 'school' && isSchoolDay(day)) || (j.days === 'weekend' && !isSchoolDay(day));

module.exports = {
  routes(r, { pool, parentOnly }) {
    // Today's jobs, ticked or not.
    r.get('/jobs', async (req, res) => {
      await seedJobs(pool, req.kid);
      const day = dayFor(req, req.kid);
      const { rows: jobs } = await pool.query(`SELECT id, title, detail, icon, slot, days, timer_secs, sort FROM kid_jobs
        WHERE child_id=$1 AND active AND removed_at IS NULL ORDER BY array_position(ARRAY['morning','after_school','bedtime','weekly'], slot), sort, created_at`, [req.kid.id]);
      const { rows: done } = await pool.query('SELECT job_id FROM kid_job_done WHERE child_id=$1 AND day=$2', [req.kid.id, day]);
      const doneSet = new Set(done.map((d) => d.job_id));
      res.json({ ok: true, day, school: isSchoolDay(day), jobs: jobs.filter((j) => jobDue(j, day)).map((j) => ({ ...j, done: doneSet.has(j.id) })) });
    });

    r.post('/jobs/:id/done', async (req, res) => {
      const day = DAY.test((req.body || {}).day || '') ? req.body.day : dayFor(req, req.kid);
      const { rows: [j] } = await pool.query('SELECT id FROM kid_jobs WHERE id=$1 AND child_id=$2 AND removed_at IS NULL', [req.params.id, req.kid.id]);
      if (!j) return res.status(404).json({ ok: false });
      if ((req.body || {}).done === false) await pool.query('DELETE FROM kid_job_done WHERE child_id=$1 AND job_id=$2 AND day=$3', [req.kid.id, j.id, day]);
      else await pool.query('INSERT INTO kid_job_done(child_id, job_id, day) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.kid.id, j.id, day]);
      res.json({ ok: true });
    });

    // Parents: edit the job list.
    r.get('/jobs/all', parentOnly, async (req, res) => {
      await seedJobs(pool, req.kid);
      const { rows } = await pool.query(`SELECT id, title, detail, icon, slot, days, timer_secs, sort, active, parent_edited FROM kid_jobs
        WHERE child_id=$1 AND removed_at IS NULL ORDER BY array_position(ARRAY['morning','after_school','bedtime','weekly'], slot), sort, created_at`, [req.kid.id]);
      res.json({ ok: true, jobs: rows, slots: ['morning', 'after_school', 'bedtime', 'weekly'], days: ['daily', 'school', 'weekend'] });
    });
    r.post('/jobs', parentOnly, async (req, res) => {
      const b = req.body || {};
      const title = str(b.title, 120); if (!title) return res.status(400).json({ ok: false, error: 'Give the job a name' });
      const slot = ['morning', 'after_school', 'bedtime', 'weekly'].includes(b.slot) ? b.slot : 'morning';
      const days = ['daily', 'school', 'weekend'].includes(b.days) ? b.days : 'daily';
      const { rows: [j] } = await pool.query(`INSERT INTO kid_jobs(child_id, title, detail, icon, slot, days, timer_secs, sort, parent_edited)
        VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(sort),0)+10 FROM kid_jobs WHERE child_id=$1),TRUE) RETURNING id`,
      [req.kid.id, title, str(b.detail, 300), str(b.icon, 4) || '✅', slot, days, b.timer_secs ? Math.max(10, Math.min(3600, parseInt(b.timer_secs, 10) || 0)) : null]);
      res.json({ ok: true, id: j.id });
    });
    r.patch('/jobs/:id', parentOnly, async (req, res) => {
      const b = req.body || {};
      const { rowCount } = await pool.query(`UPDATE kid_jobs SET title=COALESCE($3,title), detail=COALESCE($4,detail), icon=COALESCE($5,icon),
        slot=COALESCE($6,slot), days=COALESCE($7,days), timer_secs=$8, active=COALESCE($9,active), parent_edited=TRUE
        WHERE id=$1 AND child_id=$2 AND removed_at IS NULL`,
      [req.params.id, req.kid.id, str(b.title, 120), b.detail !== undefined ? str(b.detail, 300) : null, str(b.icon, 4),
        ['morning', 'after_school', 'bedtime', 'weekly'].includes(b.slot) ? b.slot : null, ['daily', 'school', 'weekend'].includes(b.days) ? b.days : null,
        b.timer_secs === undefined ? null : (b.timer_secs ? parseInt(b.timer_secs, 10) : null), typeof b.active === 'boolean' ? b.active : null]);
      res.json({ ok: !!rowCount });
    });
    r.delete('/jobs/:id', parentOnly, async (req, res) => {
      await pool.query('UPDATE kid_jobs SET removed_at=NOW() WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id]);
      res.json({ ok: true });
    });

    // Time-of-day rules (parents).
    r.get('/access', parentOnly, async (req, res) => {
      res.json({ ok: true, rules: ((req.kid.settings || {}).kids || {}).access?.rules || [], modules: require('./index').installed });
    });
    r.put('/access', parentOnly, async (req, res) => {
      const rules = (Array.isArray((req.body || {}).rules) ? req.body.rules : []).slice(0, 10).map((x) => ({
        from: String(x.from || '').slice(0, 5), to: String(x.to || '').slice(0, 5),
        allow: (Array.isArray(x.allow) ? x.allow : []).filter((m) => require('./index').installed.includes(m) || m === 'yoto' || m === 'books').slice(0, 20),
      })).filter((x) => /^\d{1,2}:\d{2}$/.test(x.from) && /^\d{1,2}:\d{2}$/.test(x.to));
      await pool.query(`UPDATE users SET settings = jsonb_set(settings, '{kids,access}', $2::jsonb, true) WHERE id=$1`, [req.kid.id, JSON.stringify({ rules })]);
      res.json({ ok: true, rules });
    });

    // The weekly plan: one activity per slot per day.
    r.get('/plan', async (req, res) => {
      const today = dayFor(req, req.kid);
      const monday = mondayOf(DAY.test(req.query.week || '') ? req.query.week : today);
      const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      const { rows } = await pool.query(`SELECT id, to_char(day,'YYYY-MM-DD') AS day, slot, activity, category, source, done FROM kid_plan
        WHERE child_id=$1 AND day BETWEEN $2 AND $3`, [req.kid.id, days[0], days[6]]);
      const { rows: ideas } = await pool.query('SELECT id, text, category FROM kid_plan_ideas WHERE child_id=$1 AND removed_at IS NULL ORDER BY created_at', [req.kid.id]);
      res.json({ ok: true, today, week: monday, days: days.map((d) => ({ day: d, school: isSchoolDay(d),
        slots: (isSchoolDay(d) ? ['after_school'] : ['weekend_am', 'weekend_pm']).map((s) => ({ slot: s, item: rows.find((x) => x.day === d && x.slot === s) || null })) })),
      categories: CATEGORIES.map((c) => ({ name: c, icon: ICON[c] })), ideas });
    });
    r.get('/plan/bank', async (req, res) => {
      const { rows: ideas } = await pool.query('SELECT id, text, category FROM kid_plan_ideas WHERE child_id=$1 AND removed_at IS NULL ORDER BY created_at', [req.kid.id]);
      res.json({ ok: true, categories: CATEGORIES.map((c) => ({ name: c, icon: ICON[c], items: BANK[c] })), ideas });
    });
    r.post('/plan', async (req, res) => {
      const b = req.body || {};
      if (!DAY.test(b.day || '') || !['after_school', 'weekend_am', 'weekend_pm'].includes(b.slot)) return res.status(400).json({ ok: false, error: 'Pick a day and a time' });
      const activity = str(b.activity, 160); if (!activity) return res.status(400).json({ ok: false, error: 'Pick something to do' });
      const category = CATEGORIES.includes(b.category) ? b.category : (b.category === 'Other' ? 'Other' : 'Other');
      await pool.query(`INSERT INTO kid_plan(child_id, day, slot, activity, category, source) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (child_id, day, slot) DO UPDATE SET activity=EXCLUDED.activity, category=EXCLUDED.category, source=EXCLUDED.source, done=FALSE`,
      [req.kid.id, b.day, b.slot, activity, category, ['bank', 'idea', 'picked', 'parent'].includes(b.source) ? b.source : 'bank']);
      res.json({ ok: true });
    });
    // "Surprise me": a suggestion from a category not already used this week.
    r.post('/plan/pick', async (req, res) => {
      const b = req.body || {};
      if (!DAY.test(b.day || '') || !['after_school', 'weekend_am', 'weekend_pm'].includes(b.slot)) return res.status(400).json({ ok: false, error: 'Pick a day and a time' });
      const monday = mondayOf(b.day);
      const { rows: used } = await pool.query('SELECT DISTINCT category FROM kid_plan WHERE child_id=$1 AND day BETWEEN $2 AND $3', [req.kid.id, monday, addDays(monday, 6)]);
      const usedSet = new Set(used.map((u) => u.category));
      const fresh = CATEGORIES.filter((c) => !usedSet.has(c));
      const cats = fresh.length ? fresh : CATEGORIES;
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const items = BANK[cat];
      const activity = items[Math.floor(Math.random() * items.length)];
      await pool.query(`INSERT INTO kid_plan(child_id, day, slot, activity, category, source) VALUES ($1,$2,$3,$4,$5,'picked')
        ON CONFLICT (child_id, day, slot) DO UPDATE SET activity=EXCLUDED.activity, category=EXCLUDED.category, source='picked', done=FALSE`,
      [req.kid.id, b.day, b.slot, activity, cat]);
      res.json({ ok: true, activity, category: cat });
    });
    r.patch('/plan/:id', async (req, res) => {
      await pool.query('UPDATE kid_plan SET done=$3 WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id, !!(req.body || {}).done]);
      res.json({ ok: true });
    });
    r.delete('/plan/:id', async (req, res) => {
      await pool.query('DELETE FROM kid_plan WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id]);
      res.json({ ok: true });
    });
    r.post('/plan/ideas', async (req, res) => {
      const text = str((req.body || {}).text, 160); if (!text) return res.status(400).json({ ok: false, error: 'Write the idea first' });
      const category = CATEGORIES.includes((req.body || {}).category) ? req.body.category : 'Other';
      await pool.query('INSERT INTO kid_plan_ideas(child_id, text, category) VALUES ($1,$2,$3)', [req.kid.id, text, category]);
      res.json({ ok: true });
    });
    r.delete('/plan/ideas/:id', async (req, res) => {
      await pool.query('UPDATE kid_plan_ideas SET removed_at=NOW() WHERE id=$1 AND child_id=$2', [req.params.id, req.kid.id]);
      res.json({ ok: true });
    });

    r.get('/jobs/guide', (req, res) => res.json({ ok: true, child: GUIDE, parents: GUIDE_PARENTS }));
  },
};
