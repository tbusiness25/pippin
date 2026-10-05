/*
 * Fitness: watch data (Garmin via the fitness backend), food diary + meal plans, workouts.
 * Every route maps to a fixed backend call for the signed-in person — no generic proxying.
 */
const express = require('express');
const sparky = require('../fitness/sparky');
const game = require('../game');

const router = express.Router();
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const q = encodeURIComponent;
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];

async function today(req) {
  const user = await game.getUser(req.uid);
  return isDay(req.query.date) ? req.query.date : game.localDay(user.tz);
}
const wrap = (fn) => async (req, res) => {
  if (!sparky.available()) return res.status(503).json({ ok: false, error: 'Fitness isn’t set up on this server (see README → Fitness).' });
  try { res.json({ ok: true, ...(await fn(req, res)) }); }
  catch (e) { res.status(e.status && e.status < 500 ? 400 : 502).json({ ok: false, error: e.message }); }
};
const quiet = (p) => p.catch(() => null);   // optional extras: a failure shouldn't break the screen

// ---------- status + Garmin ----------
router.get('/status', async (req, res) => {
  if (!sparky.available()) return res.json({ ok: true, available: false });
  try {
    const garmin = await sparky.call(req.uid, 'GET', '/api/integrations/garmin/status');
    res.json({ ok: true, available: true, garmin, syncing: syncing.has(req.uid) });
  } catch (e) { res.json({ ok: true, available: true, error: e.message }); }
});

const syncing = new Set();
function backgroundSync(uid, days) {
  if (syncing.has(uid)) return;
  syncing.add(uid);
  const end = new Date().toISOString().slice(0, 10);
  sparky.call(uid, 'POST', '/api/integrations/garmin/sync', { startDate: addDays(end, -days), endDate: end }, { timeout: 15 * 60000 })
    .catch((e) => console.warn('[fitness] garmin sync:', e.message))
    .finally(() => syncing.delete(uid));
}

router.post('/garmin/login', wrap(async (req) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw Object.assign(new Error('Enter your Garmin email and password'), { status: 400 });
  // Passed straight through to the backend, which keeps only encrypted Garmin tokens — never the password.
  const r = await sparky.call(req.uid, 'POST', '/api/integrations/garmin/login', { email: String(email), password: String(password) }, { timeout: 60000 });
  if (r?.status === 'success') backgroundSync(req.uid, 30);
  return { status: r?.status, client_state: r?.client_state };
}));
router.post('/garmin/mfa', wrap(async (req) => {
  const { client_state, mfa_code } = req.body || {};
  const r = await sparky.call(req.uid, 'POST', '/api/integrations/garmin/resume_login', { client_state, mfa_code: String(mfa_code || '').trim() }, { timeout: 60000 });
  if (r?.status === 'success') backgroundSync(req.uid, 30);
  return { status: r?.status };
}));
router.post('/garmin/sync', wrap(async (req) => { backgroundSync(req.uid, Math.min(365, Math.max(1, +(req.body?.days) || 3))); return { started: true }; }));
router.post('/garmin/unlink', wrap(async (req) => sparky.call(req.uid, 'POST', '/api/integrations/garmin/unlink', {})));

// ---------- watch data ----------
// One day in detail (+ the 7 days before it for small trends).
router.get('/day', wrap(async (req) => {
  const day = await today(req), from = addDays(day, -6);
  const [metrics, sleep, vitals, hr, stress, battery] = await Promise.all([
    sparky.call(req.uid, 'GET', `/api/generic-health/metrics?startDate=${from}&endDate=${day}`),
    sparky.call(req.uid, 'GET', `/api/sleep?startDate=${from}&endDate=${day}`),
    quiet(sparky.call(req.uid, 'GET', `/api/generic-health/vitals?startDate=${addDays(day, -60)}&endDate=${day}`)),
    quiet(sparky.call(req.uid, 'GET', `/api/generic-health/samples?metric=heart_rate&startDate=${day}&endDate=${day}`)),
    quiet(sparky.call(req.uid, 'GET', `/api/generic-health/samples?metric=stress&startDate=${day}&endDate=${day}`)),
    quiet(sparky.call(req.uid, 'GET', `/api/generic-health/samples?metric=body_battery&startDate=${day}&endDate=${day}`)),
  ]);
  const samples = (r) => (r?.data || []).flatMap((x) => (Array.isArray(x.samples) ? x.samples : []));
  return {
    day,
    metrics: metrics?.data || [],
    sleep: Array.isArray(sleep) ? sleep : sleep?.data || [],
    vitals: vitals?.data || [],
    samples: { heart_rate: samples(hr), stress: samples(stress), body_battery: samples(battery) },
  };
}));

router.get('/trends', wrap(async (req) => {
  const day = await today(req), days = Math.min(365, Math.max(7, +req.query.days || 30)), from = addDays(day, -(days - 1));
  const [metrics, sleep, vitals] = await Promise.all([
    sparky.call(req.uid, 'GET', `/api/generic-health/metrics?startDate=${from}&endDate=${day}`),
    sparky.call(req.uid, 'GET', `/api/sleep?startDate=${from}&endDate=${day}`),
    quiet(sparky.call(req.uid, 'GET', `/api/generic-health/vitals?startDate=${from}&endDate=${day}`)),
  ]);
  return { from, to: day, metrics: metrics?.data || [], sleep: Array.isArray(sleep) ? sleep : sleep?.data || [], vitals: vitals?.data || [] };
}));

// ---------- food ----------
router.get('/food/day', wrap(async (req) => {
  const day = await today(req);
  return { day, summary: await sparky.call(req.uid, 'GET', `/api/daily-summary?date=${day}`) };
}));

router.get('/food/search', wrap(async (req) => {
  const term = String(req.query.q || '').trim().slice(0, 80);
  if (term.length < 2) return { foods: [] };
  const [mine, off] = await Promise.all([
    quiet(sparky.call(req.uid, 'GET', `/api/foods/search?name=${q(term)}&broadMatch=true&checkCustom=true`)),
    quiet(sparky.call(req.uid, 'GET', `/api/v2/foods/search/openfoodfacts?query=${q(term)}&pageSize=15`)),
  ]);
  const local = (Array.isArray(mine) ? mine : mine?.searchResults || mine?.foods || []).slice(0, 10).map((f) => ({ ...f, saved: true }));
  return { foods: [...local, ...(off?.foods || []).map((f) => ({ ...f, saved: false }))] };
}));

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'saturated_fat', 'sugars', 'dietary_fiber', 'sodium'];
async function ensureFood(uid, f) {
  if (f.id && (f.default_variant?.id || f.variant_id)) return { food_id: f.id, variant_id: f.variant_id || f.default_variant.id };
  const v = f.default_variant || {};
  const body = { name: String(f.name || 'Food').slice(0, 120), brand: f.brand || null, barcode: f.barcode || null,
    provider_external_id: f.provider_external_id || null, provider_type: f.provider_type || null, is_custom: !f.provider_type,
    serving_size: Number(v.serving_size ?? f.serving_size ?? 100), serving_unit: v.serving_unit || f.serving_unit || 'g' };
  for (const k of NUTRIENTS) body[k] = Number(v[k] ?? f[k] ?? 0) || 0;
  const created = await sparky.call(uid, 'POST', '/api/foods', body);
  return { food_id: created.id, variant_id: created.default_variant?.id };
}

router.post('/food/log', wrap(async (req) => {
  const b = req.body || {};
  const day = isDay(b.date) ? b.date : await today(req);
  const meal = MEALS.includes(b.meal_type) ? b.meal_type : 'snacks';
  const ids = await ensureFood(req.uid, b.food || {});
  const entry = await sparky.call(req.uid, 'POST', '/api/food-entries', {
    ...ids, quantity: Math.max(0.1, Number(b.quantity) || 1), unit: String(b.unit || 'g').slice(0, 20), entry_date: day, meal_type: meal });
  return { entry: { id: entry.id } };
}));

// Quick add: just a name and calories (for when searching is too much effort).
router.post('/food/quick', wrap(async (req) => {
  const b = req.body || {};
  const day = isDay(b.date) ? b.date : await today(req);
  const ids = await ensureFood(req.uid, { name: String(b.name || 'Quick add').slice(0, 80), serving_size: 1, serving_unit: 'serving',
    calories: Math.max(0, Number(b.calories) || 0), protein: Number(b.protein) || 0, carbs: Number(b.carbs) || 0, fat: Number(b.fat) || 0 });
  await sparky.call(req.uid, 'POST', '/api/food-entries', { ...ids, quantity: 1, unit: 'serving', entry_date: day, meal_type: MEALS.includes(b.meal_type) ? b.meal_type : 'snacks' });
  return {};
}));

router.delete('/food/entry/:id', wrap(async (req) => sparky.call(req.uid, 'DELETE', `/api/food-entries/${q(req.params.id)}`)));

// Meal plans: a weekly template of foods per day and meal. Turning one on adds its foods to your diary.
router.get('/plans', wrap(async (req) => ({ plans: await sparky.call(req.uid, 'GET', '/api/meal-plan-templates') })));
router.post('/plans', wrap(async (req) => {
  const b = req.body || {};
  const start = isDay(b.start_date) ? b.start_date : await today(req);
  const assignments = [];
  for (const a of (Array.isArray(b.items) ? b.items : []).slice(0, 60)) {
    const ids = await ensureFood(req.uid, a.food || {});
    assignments.push({ day_of_week: Math.max(0, Math.min(6, a.day_of_week | 0)), meal_type: MEALS.includes(a.meal_type) ? a.meal_type : 'dinner',
      item_type: 'food', ...ids, quantity: Math.max(0.1, Number(a.quantity) || 1), unit: String(a.unit || 'g').slice(0, 20) });
  }
  const plan = await sparky.call(req.uid, 'POST', '/api/meal-plan-templates', {
    plan_name: String(b.name || 'My meal plan').slice(0, 80), description: String(b.description || '').slice(0, 300),
    start_date: start, end_date: isDay(b.end_date) ? b.end_date : addDays(start, 27), is_active: !!b.active,
    currentClientDate: await today(req), assignments });
  return { plan };
}));
router.delete('/plans/:id', wrap(async (req) => sparky.call(req.uid, 'DELETE', `/api/meal-plan-templates/${q(req.params.id)}`)));

// ---------- workouts ----------
router.get('/workouts/day', wrap(async (req) => {
  const day = await today(req);
  return { day, entries: await sparky.call(req.uid, 'GET', `/api/exercise-entries/by-date?selectedDate=${day}`) };
}));
router.get('/workouts/recent', wrap(async (req) => {
  const day = await today(req);
  const days = Array.from({ length: 14 }, (_, i) => addDays(day, -i));
  const lists = await Promise.all(days.map((d) => quiet(sparky.call(req.uid, 'GET', `/api/exercise-entries/by-date?selectedDate=${d}`))));
  return { entries: lists.flatMap((l) => l || []) };
}));

router.get('/exercises/search', wrap(async (req) => {
  const term = String(req.query.q || '').trim().slice(0, 80);
  if (term.length < 2) return { exercises: [] };
  const [mine, ext] = await Promise.all([
    quiet(sparky.call(req.uid, 'GET', `/api/exercises/search?searchTerm=${q(term)}`)),
    quiet(sparky.call(req.uid, 'GET', `/api/exercises/search-external?query=${q(term)}&providerType=free-exercise-db&providerId=free`)),
  ]);
  const local = (Array.isArray(mine) ? mine : mine?.exercises || []).slice(0, 10).map((e) => ({ id: e.id, name: e.name, category: e.category, saved: true }));
  const names = new Set(local.map((e) => e.name.toLowerCase()));
  const extra = (Array.isArray(ext) ? ext : ext?.exercises || []).filter((e) => !names.has(String(e.name).toLowerCase())).slice(0, 20)
    .map((e) => ({ external_id: e.id, name: e.name, category: e.category, equipment: e.equipment, muscles: e.primary_muscles, saved: false }));
  return { exercises: [...local, ...extra] };
}));

async function ensureExercise(uid, b) {
  if (b.exercise_id) return b.exercise_id;
  if (!b.external_id) throw Object.assign(new Error('Pick an exercise'), { status: 400 });
  return (await sparky.call(uid, 'POST', '/api/freeexercisedb/add', { exerciseId: String(b.external_id) })).id;
}
const cleanSets = (sets) => (Array.isArray(sets) ? sets : []).slice(0, 20).map((s, i) => ({ set_number: i + 1,
  reps: s.reps == null || s.reps === '' ? null : Number(s.reps), weight: s.weight == null || s.weight === '' ? null : Number(s.weight),
  duration: s.duration == null || s.duration === '' ? null : Math.round(Number(s.duration)) }));

router.post('/workouts/log', wrap(async (req) => {
  const b = req.body || {};
  const exercise_id = await ensureExercise(req.uid, b);
  const entry = await sparky.call(req.uid, 'POST', '/api/exercise-entries', {
    exercise_id, entry_date: isDay(b.date) ? b.date : await today(req),
    duration_minutes: Math.max(0, Number(b.duration_minutes) || 0), calories_burned: Math.max(0, Number(b.calories_burned) || 0),
    sets: cleanSets(b.sets), notes: b.notes ? String(b.notes).slice(0, 300) : null });
  return { entry: { id: entry.id } };
}));
router.delete('/workouts/entry/:id', wrap(async (req) => sparky.call(req.uid, 'DELETE', `/api/exercise-entries/${q(req.params.id)}`)));

// Workout plans ("presets"): a named list of exercises with sets, logged in one tap.
router.get('/workouts/presets', wrap(async (req) => {
  const r = await sparky.call(req.uid, 'GET', '/api/workout-presets?limit=50');
  return { presets: r?.presets || [] };
}));
router.post('/workouts/presets', wrap(async (req) => {
  const b = req.body || {};
  const exercises = [];
  for (const [i, x] of (Array.isArray(b.exercises) ? b.exercises : []).slice(0, 20).entries()) {
    exercises.push({ exercise_id: await ensureExercise(req.uid, x), sort_order: i, sets: cleanSets(x.sets) });
  }
  return { preset: await sparky.call(req.uid, 'POST', '/api/workout-presets', { name: String(b.name || 'Workout').slice(0, 80), exercises }) };
}));
router.post('/workouts/presets/:id/log', wrap(async (req) => {
  const p = await sparky.call(req.uid, 'GET', `/api/workout-presets/${q(req.params.id)}`);
  const day = isDay(req.body?.date) ? req.body.date : await today(req);
  let n = 0;
  for (const x of p?.exercises || []) {
    await sparky.call(req.uid, 'POST', '/api/exercise-entries', { exercise_id: x.exercise_id, entry_date: day, duration_minutes: 0, calories_burned: 0,
      sets: (x.sets || []).map((s, i) => ({ set_number: i + 1, reps: s.reps ?? null, weight: s.weight ?? null, duration: s.duration ?? null })) });
    n++;
  }
  return { logged: n };
}));
router.delete('/workouts/presets/:id', wrap(async (req) => sparky.call(req.uid, 'DELETE', `/api/workout-presets/${q(req.params.id)}`)));

module.exports = router;
