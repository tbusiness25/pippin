/* Fitness: watch data (Garmin), food diary + meal plans, workouts. Backed by /api/fitness. */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const todayStr = () => new Date().toLocaleDateString('en-CA');
  const shift = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
  const nice = (d) => d === todayStr() ? 'Today' : d === shift(todayStr(), -1) ? 'Yesterday' : new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const hm = (s) => s == null ? '—' : `${Math.floor(s / 3600)}h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}m`;
  const num = (v, d = 0) => v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: d });
  const modeSwitch = (on) => `<div class="tabs2">${[['fitness', '⌚ Watch'], ['food', '🍽️ Food'], ['workouts', '🏋️ Workouts']].map(([k, l]) => `<a class="chip ${on === k ? 'on' : ''}" href="#${k}" style="text-decoration:none;color:inherit">${l}</a>`).join('')}</div>`;
  const dateNav = (route, d) => `<div class="row" style="margin-bottom:10px"><a class="btn ghost" href="#${route}/${shift(d, -1)}">‹</a><b class="grow center">${nice(d)}</b>${d < todayStr() ? `<a class="btn ghost" href="#${route}/${shift(d, 1)}">›</a>` : '<span class="btn ghost" style="visibility:hidden">›</span>'}</div>`;
  const notReady = (e) => `<div class="card"><h2>Fitness isn’t switched on</h2><p class="small muted">${esc(e || 'This server doesn’t have the fitness add-on yet.')} See “Fitness” in the README to turn it on.</p></div>`;

  // Small SVG line chart for a list of numbers (gaps allowed).
  function spark(values, { h = 46, color = 'var(--moss)', fill = true } = {}) {
    const v = values.map((x) => (x == null || Number.isNaN(+x) ? null : +x));
    const pts = v.filter((x) => x != null);
    if (pts.length < 2) return '<div class="small muted">Not enough data yet</div>';
    const min = Math.min(...pts), max = Math.max(...pts), w = 300, span = max - min || 1;
    const xy = v.map((x, i) => x == null ? null : [(i / (v.length - 1)) * w, h - 4 - ((x - min) / span) * (h - 8)]);
    const d = xy.reduce((a, p, i) => p ? `${a}${a && xy[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : a, '');
    const first = xy.find(Boolean), last = [...xy].reverse().find(Boolean);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block" aria-hidden="true">
      ${fill ? `<path d="${d}L${last[0]},${h}L${first[0]},${h}Z" fill="${color}" opacity=".12"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const bars = (values, { h = 46, color = 'var(--moss)' } = {}) => {
    const max = Math.max(1, ...values.map((x) => +x || 0));
    return `<div style="display:flex;align-items:flex-end;gap:3px;height:${h}px">${values.map((x) => `<div style="flex:1;background:${color};opacity:${x ? 0.85 : 0.15};height:${Math.max(3, ((+x || 0) / max) * h)}px;border-radius:3px 3px 0 0"></div>`).join('')}</div>`;
  };
  // Samples come as [{timestamp|time, value}] in different spellings — normalise.
  const series = (s) => (s || []).map((p) => (Array.isArray(p) ? p[1] : p.value ?? p.v ?? p.level ?? p.bpm ?? null));

  // ---------- Watch ----------
  async function watch(arg) {
    F.setTab('explore');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : todayStr();
    const st = await api('/api/fitness/status').catch((e) => ({ error: e.message }));
    if (!st.available) { $app.innerHTML = modeSwitch('fitness') + notReady(st.error); return; }
    if (!st.garmin?.isLinked) return connect();
    $app.innerHTML = `${modeSwitch('fitness')}${dateNav('fitness', day)}<p class="typing">Loading your watch data…</p>`;
    const [d, t] = await Promise.all([api(`/api/fitness/day?date=${day}`), api(`/api/fitness/trends?days=30&date=${day}`)]);
    const m = d.metrics.find((x) => x.entry_date?.slice(0, 10) === day) || {};
    const sl = d.sleep.find((x) => String(x.entry_date).slice(0, 10) === day) || {};
    const bp = [...d.vitals].filter((v) => v.systolic_mmhg).sort((a, b) => String(b.timestamp || b.entry_date).localeCompare(String(a.timestamp || a.entry_date)))[0];
    const byDay = (rows, key) => { const map = Object.fromEntries(rows.map((r) => [String(r.entry_date).slice(0, 10), r[key]])); return Array.from({ length: 30 }, (_, i) => map[shift(day, i - 29)] ?? null); };
    const stepsGoal = m.step_goal || 7500;
    const stages = [['Deep', sl.deep_sleep_seconds, '#3b5b8c'], ['Light', sl.light_sleep_seconds, '#7aa2d6'], ['REM', sl.rem_sleep_seconds, '#b48ad6'], ['Awake', sl.awake_sleep_seconds, '#e8c9a0']];
    const stageTotal = stages.reduce((a, s) => a + (s[1] || 0), 0);
    const tile = (title, big, sub, extra = '') => `<div class="card" style="margin:0"><div class="small muted">${title}</div><div style="font-family:var(--display);font-size:1.7rem;line-height:1.2">${big}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}${extra}</div>`;
    $app.innerHTML = `${modeSwitch('fitness')}${dateNav('fitness', day)}
      <div class="card"><div class="row"><div class="grow"><div class="small muted">😴 Sleep${sl.sleep_score != null ? ` · score ${num(sl.sleep_score)}` : ''}</div>
        <div style="font-family:var(--display);font-size:2rem">${hm(sl.time_asleep_in_seconds ?? sl.duration_in_seconds)}</div></div>
        <div class="small muted" style="text-align:right">${sl.bedtime ? `${new Date(sl.bedtime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} → ${new Date(sl.wake_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</div></div>
        ${stageTotal ? `<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin:8px 0 6px">${stages.map(([, s, c]) => `<div style="flex:${s || 0};background:${c}"></div>`).join('')}</div>
          <div class="row small" style="flex-wrap:wrap;gap:10px">${stages.map(([n, s, c]) => `<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c}"></span> ${n} ${hm(s)}</span>`).join('')}</div>` : '<p class="small muted">No sleep recorded for this night.</p>'}
        <div class="small muted" style="margin-top:6px">${[sl.avg_overnight_hrv != null && `HRV ${num(sl.avg_overnight_hrv)} ms`, sl.resting_heart_rate != null && `resting HR ${num(sl.resting_heart_rate)}`, sl.average_spo2_value != null && `SpO₂ ${num(sl.average_spo2_value)}%`, sl.average_respiration_value != null && `breathing ${num(sl.average_respiration_value, 1)}/min`, sl.body_battery_change != null && `body battery +${num(sl.body_battery_change)}`].filter(Boolean).join(' · ')}</div></div>
      <div class="grid">
        ${tile('👣 Steps', num(m.total_steps), `of ${num(stepsGoal)}${m.total_distance_meters ? ` · ${num(m.total_distance_meters / 1000, 1)} km` : ''}`, `<div style="height:6px;background:var(--line);border-radius:3px;margin-top:6px"><div style="height:6px;width:${Math.min(100, ((m.total_steps || 0) / stepsGoal) * 100)}%;background:var(--moss);border-radius:3px"></div></div>`)}
        ${tile('🔋 Body Battery', m.body_battery_highest != null ? `${num(m.body_battery_lowest)}–${num(m.body_battery_highest)}` : '—', m.body_battery_charged != null ? `+${num(m.body_battery_charged)} charged · −${num(m.body_battery_drained)} used` : '', d.samples.body_battery.length > 2 ? spark(series(d.samples.body_battery), { color: '#3d8bd8' }) : '')}
        ${tile('🌀 Stress', num(m.avg_stress_level), m.max_stress_level != null ? `average · peak ${num(m.max_stress_level)}` : 'average', d.samples.stress.length > 2 ? spark(series(d.samples.stress), { color: '#e0a040' }) : '')}
        ${tile('❤️ Heart rate', num(m.resting_heart_rate), 'resting bpm', d.samples.heart_rate.length > 2 ? spark(series(d.samples.heart_rate), { color: '#d0605a' }) : '')}
        ${tile('💓 HRV', num(sl.avg_overnight_hrv), 'ms overnight')}
        ${tile('🩺 Blood pressure', bp ? `${num(bp.systolic_mmhg)}/${num(bp.diastolic_mmhg)}` : '—', bp ? `mmHg · ${nice(String(bp.entry_date).slice(0, 10))}` : 'none recorded')}
        ${tile('💪 Training readiness', num(m.training_readiness_score), m.recovery_time_hours != null ? `recovery ${num(m.recovery_time_hours)} h` : '')}
        ${tile('⚡ Intensity minutes', num((m.moderate_intensity_minutes || 0) + 2 * (m.vigorous_intensity_minutes || 0)), `${num(m.moderate_intensity_minutes)} moderate · ${num(m.vigorous_intensity_minutes)} vigorous`)}
        ${tile('🔥 Calories', num(m.active_calories), `active · ${num(m.total_calories)} total`)}
        ${tile('🏃 VO₂ max', num(m.vo2_max), m.fitness_age != null ? `fitness age ${num(m.fitness_age)}` : '')}
        ${tile('🪜 Floors', num(m.floors_ascended), 'climbed')}
      </div>
      <div class="card" style="margin-top:14px"><h2>Last 30 days</h2>
        <div class="small muted">Steps</div>${bars(byDay(t.metrics, 'total_steps'))}
        <div class="small muted" style="margin-top:10px">Sleep (hours)</div>${bars(byDay(t.sleep, 'time_asleep_in_seconds').map((s) => s && s / 3600), { color: '#7aa2d6' })}
        <div class="small muted" style="margin-top:10px">Overnight HRV</div>${spark(byDay(t.sleep, 'avg_overnight_hrv'), { color: '#b48ad6' })}
        <div class="small muted" style="margin-top:10px">Resting heart rate</div>${spark(byDay(t.metrics, 'resting_heart_rate'), { color: '#d0605a' })}
        <div class="small muted" style="margin-top:10px">Average stress</div>${spark(byDay(t.metrics, 'avg_stress_level'), { color: '#e0a040' })}
        ${t.vitals.some((v) => v.systolic_mmhg) ? `<div class="small muted" style="margin-top:10px">Blood pressure (systolic)</div>${spark(byDay(t.vitals, 'systolic_mmhg'), { color: '#c06070', fill: false })}` : ''}</div>
      <div class="card"><div class="row"><div class="grow small muted">⌚ Garmin connected${st.garmin.lastUpdated ? ` · updated ${new Date(st.garmin.lastUpdated).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}. Syncs every hour.</div>
        <button class="btn ghost" id="sync">${st.syncing ? 'Syncing…' : '↻ Sync now'}</button></div>
        <button class="btn ghost small" id="unlink" style="padding-left:0">Disconnect Garmin</button></div>`;
    document.getElementById('sync').onclick = async (e) => { await api('/api/fitness/garmin/sync', { body: { days: 3 } }); e.target.textContent = 'Syncing… (a minute or two)'; e.target.disabled = true; setTimeout(() => watch(day), 60000); };
    document.getElementById('unlink').onclick = async () => { if (confirm('Disconnect Garmin? Your saved data stays.')) { await api('/api/fitness/garmin/unlink', { body: {} }); watch(day); } };
  }

  function connect() {
    $app.innerHTML = `${modeSwitch('fitness')}<div class="card"><h1>Connect your Garmin</h1>
      <p class="small muted">Sign in with your Garmin Connect account. Your sleep, heart rate, HRV, stress, Body Battery, steps, blood pressure and workouts then sync here every hour.</p>
      <p class="small muted">🔒 Your password goes to Garmin to sign in and isn’t stored — only Garmin’s sign-in token is kept, encrypted, on this server. This uses an unofficial connection, so Garmin may occasionally ask you to sign in again.</p>
      <div class="field"><label for="ge">Garmin email</label><input id="ge" type="email" autocomplete="username"></div>
      <div class="field"><label for="gp">Garmin password</label><input id="gp" type="password" autocomplete="current-password"></div>
      <button class="btn block" id="go">Connect</button><div id="mfa"></div></div>`;
    const go = document.getElementById('go');
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Signing in…';
      try {
        const r = await api('/api/fitness/garmin/login', { body: { email: ge.value, password: gp.value } });
        gp.value = '';
        if (r.status === 'needs_mfa') {
          document.getElementById('mfa').innerHTML = `<div class="field" style="margin-top:12px"><label for="mc">Garmin sent you a code — enter it here</label><input id="mc" inputmode="numeric" autocomplete="one-time-code"></div><button class="btn block" id="mgo">Confirm</button>`;
          document.getElementById('mgo').onclick = async () => {
            try { await api('/api/fitness/garmin/mfa', { body: { client_state: r.client_state, mfa_code: mc.value } }); done(); } catch (e) { toast(e.message); }
          };
          go.textContent = 'Waiting for the code…';
        } else done();
      } catch (e) { toast(e.message); go.disabled = false; go.textContent = 'Connect'; }
    };
    const done = () => { $app.innerHTML = `${modeSwitch('fitness')}<div class="card center"><h1>Connected ✓</h1><p>Fetching your last 30 days from Garmin. This takes a few minutes the first time.</p><a class="btn" href="#fitness">Show me</a></div>`; };
  }

  // ---------- Food ----------
  // Numbers can be switched off: some people do better logging what they eat without calories or macros.
  const numbersOn = () => { try { return localStorage.getItem('food-numbers') !== 'off'; } catch (_) { return true; } };
  const MEALS = [['breakfast', '🌅 Breakfast'], ['lunch', '🥪 Lunch'], ['dinner', '🍲 Dinner'], ['snacks', '🍎 Snacks']];
  const kcal = (e) => Math.round((e.calories || 0) * (e.quantity || 0) / (e.serving_size || 1));
  const macro = (e, k) => (e[k] || 0) * (e.quantity || 0) / (e.serving_size || 1);

  async function food(arg) {
    F.setTab('explore');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : todayStr();
    let d; try { d = await api(`/api/fitness/food/day?date=${day}`); } catch (e) { $app.innerHTML = modeSwitch('food') + notReady(e.message); return; }
    const s = d.summary, entries = s.foodEntries || [], cb = s.calorieBalance || {}, g = s.goals || {};
    const tot = (k) => entries.reduce((a, e) => a + macro(e, k), 0);
    const bar = (label, v, goal, color) => `<div style="margin:6px 0"><div class="row small"><span class="grow">${label}</span><span class="muted">${Math.round(v)} / ${Math.round(goal || 0)} g</span></div>
      <div style="height:6px;background:var(--line);border-radius:3px"><div style="height:6px;width:${Math.min(100, goal ? (v / goal) * 100 : 0)}%;background:${color};border-radius:3px"></div></div></div>`;
    const plans = await api('/api/fitness/plans').then((r) => r.plans || []).catch(() => []);
    const showNums = numbersOn();
    const k = (e) => (showNums ? `${kcal(e)} kcal` : '');
    $app.innerHTML = `${modeSwitch('food')}${dateNav('food', day)}
      ${showNums ? `<div class="card"><div class="row" style="align-items:flex-end"><div class="grow"><div class="small muted">Eaten</div><div style="font-family:var(--display);font-size:2rem">${num(cb.eaten)} <span class="small muted">kcal</span></div></div>
        <div style="text-align:right"><div class="small muted">${cb.remaining >= 0 ? 'Left today' : 'Over your guide by'}</div><div style="font-family:var(--display);font-size:1.4rem">${num(Math.abs(cb.remaining ?? 0))}</div></div></div>
        <div class="small muted">Guide ${num(cb.goal)} kcal${cb.burned ? ` · ${num(cb.burned)} burned moving` : ''}</div>
        ${bar('Protein', tot('protein'), g.protein, '#5a9b6e')}${bar('Carbs', tot('carbs'), g.carbs, '#e0a040')}${bar('Fat', tot('fat'), g.fat, '#7aa2d6')}
        <p class="small muted" style="margin:.4em 0 0">A guide, not a rule. Eating something is always better than skipping a meal.</p></div>`
        : '<div class="card"><p class="small muted" style="margin:0">Logging what you eat, without the numbers. Regular meals matter more than any total.</p></div>'}
      ${MEALS.map(([k, label]) => { const list = entries.filter((e) => e.meal_type === k); return `<div class="card"><div class="row"><h2 class="grow">${label}</h2><span class="small muted">${list.length && showNums ? `${list.reduce((a, e) => a + kcal(e), 0)} kcal` : ''}</span><button class="btn ghost" data-add="${k}">+ Add</button></div>
        ${list.map((e) => `<div class="row small" style="padding:6px 0;border-top:1px solid var(--line)"><span class="grow">${esc(e.food_name)}${e.brand_name ? ` <span class="muted">${esc(e.brand_name)}</span>` : ''}<br><span class="muted">${num(e.quantity, 1)} ${esc(e.unit || '')}</span></span><span>${k(e)}</span><button class="btn ghost" data-del="${e.id}" aria-label="Remove">✕</button></div>`).join('') || '<p class="small muted" style="margin:0">Nothing yet.</p>'}</div>`; }).join('')}
      <div class="card"><div class="row"><h2 class="grow">🗓️ Meal plans</h2><button class="btn ghost" id="newPlan">+ New</button></div>
        <p class="small muted">Plan a week of meals once. Turning a plan on adds its meals to your diary each day — less deciding when you’re tired.</p>
        ${plans.map((p) => `<div class="row small" style="padding:6px 0;border-top:1px solid var(--line)"><span class="grow"><b>${esc(p.plan_name)}</b>${p.is_active ? ' · on' : ''}<br><span class="muted">${esc(String(p.start_date).slice(0, 10))} → ${esc(String(p.end_date).slice(0, 10))} · ${(p.assignments || []).length} meals</span></span><button class="btn ghost" data-pdel="${p.id}" aria-label="Delete plan">✕</button></div>`).join('') || '<p class="small muted" style="margin:0">No plans yet.</p>'}</div>
      <button class="btn ghost block" id="nums">${showNums ? '🙈 Hide calories and macros' : '🔢 Show calories and macros'}</button>`;
    $app.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => addFood(day, b.dataset.add, () => food(day)));
    $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { await api(`/api/fitness/food/entry/${b.dataset.del}`, { method: 'DELETE' }); food(day); });
    $app.querySelectorAll('[data-pdel]').forEach((b) => b.onclick = async () => { if (confirm('Delete this meal plan? (Meals already in your diary stay.)')) { await api(`/api/fitness/plans/${b.dataset.pdel}`, { method: 'DELETE' }); food(day); } });
    document.getElementById('newPlan').onclick = () => newPlan(() => food(day));
    document.getElementById('nums').onclick = () => { try { localStorage.setItem('food-numbers', showNums ? 'off' : 'on'); } catch (_) {} food(day); };
  }

  // Search → pick → amount. onPick(food, qty, unit) lets meal plans reuse the same picker.
  function pickFood(title, onPick) {
    sheet(`<h1>${title}</h1><input id="fq" placeholder="Search foods, e.g. porridge" autocomplete="off"><div id="fr" style="margin-top:10px"></div>
      <details style="margin-top:12px"><summary class="small">Quick add (just a name and calories)</summary><div class="row" style="margin-top:8px"><input id="qn" placeholder="What" class="grow"><input id="qk" inputmode="numeric" placeholder="kcal" style="max-width:90px"><button class="btn" id="qa">Add</button></div></details>`, (sh, close) => {
      let t = null, results = [];
      const fr = sh.querySelector('#fr');
      sh.querySelector('#fq').oninput = (e) => { clearTimeout(t); const v = e.target.value.trim(); if (v.length < 2) { fr.innerHTML = ''; return; } fr.innerHTML = '<p class="typing small">Searching…</p>';
        t = setTimeout(async () => { try { results = (await api(`/api/fitness/food/search?q=${encodeURIComponent(v)}`)).foods; } catch (er) { fr.innerHTML = `<p class="small">${esc(er.message)}</p>`; return; }
          fr.innerHTML = results.map((f, i) => { const v2 = f.default_variant || {}; return `<button class="friend" data-i="${i}" style="width:100%;text-align:left;background:none;border:0;padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(f.name)}</b>${f.brand ? ` <span class="small muted">${esc(f.brand)}</span>` : ''}${f.saved ? ' <span class="small">★</span>' : ''}<div class="small muted">${num(v2.calories)} kcal per ${num(v2.serving_size)} ${esc(v2.serving_unit || '')}</div></div></button>`; }).join('') || '<p class="small muted">Nothing found — try fewer words, or use quick add.</p>';
          fr.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { const f = results[+b.dataset.i], v2 = f.default_variant || {};
            fr.innerHTML = `<div class="card" style="margin:0"><b>${esc(f.name)}</b><div class="row" style="margin-top:8px"><input id="fqty" inputmode="decimal" value="${esc(v2.serving_size || 100)}" style="max-width:110px"><span>${esc(v2.serving_unit || 'g')}</span><span class="grow"></span><button class="btn" id="fadd">Add</button></div><div class="small muted" id="fk"></div></div>`;
            const upd = () => { sh.querySelector('#fk').textContent = `≈ ${Math.round((v2.calories || 0) * (+sh.querySelector('#fqty').value || 0) / (v2.serving_size || 1))} kcal`; };
            sh.querySelector('#fqty').oninput = upd; upd();
            sh.querySelector('#fadd').onclick = async () => { try { await onPick(f, +sh.querySelector('#fqty').value, v2.serving_unit || 'g'); close(); } catch (er) { toast(er.message); } };
          });
        }, 350);
      };
      sh.querySelector('#qa').onclick = async () => { try { await onPick(null, null, null, { name: sh.querySelector('#qn').value, calories: +sh.querySelector('#qk').value }); close(); } catch (er) { toast(er.message); } };
      setTimeout(() => sh.querySelector('#fq').focus(), 50);
    });
  }
  function addFood(day, meal, after) {
    pickFood(`Add to ${meal}`, async (f, qty, unit, quick) => {
      if (quick) await api('/api/fitness/food/quick', { body: { ...quick, meal_type: meal, date: day } });
      else await api('/api/fitness/food/log', { body: { food: f, quantity: qty, unit, meal_type: meal, date: day } });
      toast('Added'); after();
    });
  }
  function newPlan(after) {
    const items = [];
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const draw = (sh) => { sh.querySelector('#items').innerHTML = items.map((it, i) => `<div class="row small" style="border-top:1px solid var(--line);padding:6px 0"><span class="grow">${DAYS[it.day_of_week]} · ${it.meal_type} · ${esc(it.food.name)} (${num(it.quantity)} ${esc(it.unit)})</span><button class="btn ghost" data-x="${i}">✕</button></div>`).join('') || '<p class="small muted">No meals added yet.</p>';
      sh.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { items.splice(+b.dataset.x, 1); draw(sh); }); };
    sheet(`<h1>New meal plan</h1><div class="field"><label for="pn">Name</label><input id="pn" value="Weeknight dinners"></div>
      <div class="row"><select id="pd">${DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select><select id="pm">${MEALS.map(([k, l]) => `<option value="${k}" ${k === 'dinner' ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn secondary" id="pf">+ Food</button></div>
      <div id="items" style="margin-top:8px"></div>
      <label class="row" style="margin-top:10px"><input type="checkbox" id="pa" style="width:22px;height:22px"><span>Turn it on now (adds these meals to your diary for the next 4 weeks)</span></label>
      <button class="btn block" id="psave" style="margin-top:10px">Save plan</button>`, (sh, close) => {
      draw(sh);
      sh.querySelector('#pf').onclick = () => { const dow = +sh.querySelector('#pd').value, meal = sh.querySelector('#pm').value;
        pickFood('Add to the plan', async (f, qty, unit) => { if (!f) throw new Error('Search for a food to add it to a plan'); items.push({ day_of_week: dow, meal_type: meal, food: f, quantity: qty, unit }); draw(sh); }); };
      sh.querySelector('#psave').onclick = async () => { if (!items.length) return toast('Add at least one meal');
        try { await api('/api/fitness/plans', { body: { name: sh.querySelector('#pn').value, items, active: sh.querySelector('#pa').checked } }); close(); toast('Plan saved'); after(); } catch (e) { toast(e.message); } };
    });
  }

  // ---------- Workouts ----------
  async function workouts(arg) {
    F.setTab('explore');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : todayStr();
    let d; try { d = await api(`/api/fitness/workouts/day?date=${day}`); } catch (e) { $app.innerHTML = modeSwitch('workouts') + notReady(e.message); return; }
    const [presets, recent] = await Promise.all([api('/api/fitness/workouts/presets').then((r) => r.presets).catch(() => []), api('/api/fitness/workouts/recent?date=' + day).then((r) => r.entries).catch(() => [])]);
    const row = (e) => `<div class="row small" style="padding:8px 0;border-top:1px solid var(--line);align-items:flex-start"><span class="grow"><b>${esc(e.name || e.exercise_snapshot?.name || 'Exercise')}</b>
      <br><span class="muted">${[e.duration_minutes ? `${num(e.duration_minutes)} min` : '', e.distance ? `${num(e.distance, 2)} km` : '', e.calories_burned ? `${num(e.calories_burned)} kcal` : '', e.avg_heart_rate ? `♥ ${num(e.avg_heart_rate)}` : ''].filter(Boolean).join(' · ')}</span>
      ${(e.sets || []).length ? `<br><span class="muted">${e.sets.map((s) => s.reps != null ? `${num(s.reps)}${s.weight ? ` × ${num(s.weight, 1)} kg` : ''}` : s.duration ? `${num(s.duration)} s` : '').filter(Boolean).join(', ')}</span>` : ''}</span>
      <button class="btn ghost" data-del="${e.id}" aria-label="Remove">✕</button></div>`;
    $app.innerHTML = `${modeSwitch('workouts')}${dateNav('workouts', day)}
      <div class="card"><div class="row"><h2 class="grow">${nice(day)}</h2><button class="btn" id="log">+ Log</button></div>
        ${(d.entries || []).map(row).join('') || '<p class="small muted" style="margin:0">Nothing logged. Any movement counts — a walk is a workout.</p>'}</div>
      <div class="card"><div class="row"><h2 class="grow">📋 Workout plans</h2><button class="btn ghost" id="newPreset">+ New</button></div>
        <p class="small muted">Save a routine once, then log the whole thing in one tap.</p>
        ${presets.map((p) => `<div class="row small" style="padding:6px 0;border-top:1px solid var(--line)"><span class="grow"><b>${esc(p.name)}</b><br><span class="muted">${(p.exercises || []).map((x) => esc(x.exercise_name || x.name || '')).filter(Boolean).join(', ')}</span></span><button class="btn secondary" data-do="${p.id}">Did it</button><button class="btn ghost" data-pdel="${p.id}" aria-label="Delete">✕</button></div>`).join('') || '<p class="small muted" style="margin:0">No plans yet.</p>'}</div>
      <div class="card"><h2>Last two weeks</h2>${recent.filter((e) => String(e.entry_date).slice(0, 10) !== day).slice(0, 25).map((e) => `<div class="small muted" style="margin-top:6px">${nice(String(e.entry_date).slice(0, 10))}</div>${row(e)}`).join('') || '<p class="small muted">Nothing yet. Garmin activities appear here automatically.</p>'}</div>`;
    $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { await api(`/api/fitness/workouts/entry/${b.dataset.del}`, { method: 'DELETE' }); workouts(day); });
    $app.querySelectorAll('[data-do]').forEach((b) => b.onclick = async () => { const r = await api(`/api/fitness/workouts/presets/${b.dataset.do}/log`, { body: { date: day } }); toast(`Logged ${r.logged} exercises 💪`); workouts(day); });
    $app.querySelectorAll('[data-pdel]').forEach((b) => b.onclick = async () => { if (confirm('Delete this plan?')) { await api(`/api/fitness/workouts/presets/${b.dataset.pdel}`, { method: 'DELETE' }); workouts(day); } });
    document.getElementById('log').onclick = () => exerciseSheet('Log exercise', async (ex) => { await api('/api/fitness/workouts/log', { body: { ...ex, date: day } }); toast('Logged 💪'); workouts(day); });
    document.getElementById('newPreset').onclick = () => newPreset(() => workouts(day));
  }

  // Search an exercise, then sets (reps × kg) or a duration.
  function exerciseSheet(title, onDone, { forPlan = false } = {}) {
    sheet(`<h1>${title}</h1><input id="xq" placeholder="Search, e.g. squat, walk, plank" autocomplete="off"><div id="xr" style="margin-top:10px"></div>`, (sh, close) => {
      let t = null, results = [];
      const xr = sh.querySelector('#xr');
      sh.querySelector('#xq').oninput = (e) => { clearTimeout(t); const v = e.target.value.trim(); if (v.length < 2) { xr.innerHTML = ''; return; } xr.innerHTML = '<p class="typing small">Searching…</p>';
        t = setTimeout(async () => { results = (await api(`/api/fitness/exercises/search?q=${encodeURIComponent(v)}`)).exercises;
          xr.innerHTML = results.map((x, i) => `<button data-i="${i}" style="width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:8px 0"><b>${esc(x.name)}</b>${x.saved ? ' ★' : ''}<div class="small muted">${esc([x.category, ...(x.equipment || [])].filter(Boolean).join(' · '))}</div></button>`).join('') || '<p class="small muted">Nothing found.</p>';
          xr.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => form(results[+b.dataset.i]));
        }, 350);
      };
      const form = (x) => {
        const sets = [{ reps: 10, weight: '' }];
        const drawSets = () => { sh.querySelector('#sets').innerHTML = sets.map((s, i) => `<div class="row small" style="margin-top:6px"><span style="width:44px">Set ${i + 1}</span><input data-r="${i}" inputmode="numeric" value="${s.reps}" style="max-width:70px"> reps <input data-w="${i}" inputmode="decimal" value="${s.weight}" placeholder="kg" style="max-width:70px"> kg</div>`).join('');
          sh.querySelectorAll('[data-r]').forEach((n) => n.oninput = () => { sets[+n.dataset.r].reps = n.value; });
          sh.querySelectorAll('[data-w]').forEach((n) => n.oninput = () => { sets[+n.dataset.w].weight = n.value; }); };
        xr.innerHTML = `<div class="card" style="margin:0"><b>${esc(x.name)}</b><div id="sets"></div><button class="btn ghost small" id="addSet" style="padding-left:0">+ Set</button>
          ${forPlan ? '' : '<div class="row small" style="margin-top:8px"><input id="dur" inputmode="numeric" placeholder="minutes" style="max-width:90px"> min <input id="cal" inputmode="numeric" placeholder="kcal" style="max-width:90px"> kcal <span class="muted">(optional)</span></div>'}
          <button class="btn block" id="xsave" style="margin-top:10px">${forPlan ? 'Add to plan' : 'Log it'}</button></div>`;
        drawSets();
        sh.querySelector('#addSet').onclick = () => { sets.push({ ...sets[sets.length - 1] }); drawSets(); };
        sh.querySelector('#xsave').onclick = async () => {
          const body = { exercise_id: x.saved ? x.id : undefined, external_id: x.saved ? undefined : x.external_id, name: x.name,
            sets: sets.filter((s) => s.reps !== '' || s.weight !== '').map((s) => ({ reps: s.reps === '' ? null : +s.reps, weight: s.weight === '' ? null : +s.weight })),
            duration_minutes: forPlan ? undefined : +(sh.querySelector('#dur').value || 0), calories_burned: forPlan ? undefined : +(sh.querySelector('#cal').value || 0) };
          try { await onDone(body); close(); } catch (e) { toast(e.message); }
        };
      };
      setTimeout(() => sh.querySelector('#xq').focus(), 50);
    });
  }
  function newPreset(after) {
    const ex = [];
    sheet(`<h1>New workout plan</h1><div class="field"><label for="wn">Name</label><input id="wn" placeholder="e.g. Monday strength"></div><div id="wl"></div>
      <button class="btn secondary block" id="wadd">+ Exercise</button><button class="btn block" id="wsave" style="margin-top:10px">Save plan</button>`, (sh, close) => {
      const draw = () => { sh.querySelector('#wl').innerHTML = ex.map((x) => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><b>${esc(x.name)}</b> <span class="muted">${x.sets.map((s) => `${s.reps ?? ''}${s.weight ? `×${s.weight}kg` : ''}`).join(', ')}</span></div>`).join(''); };
      sh.querySelector('#wadd').onclick = () => exerciseSheet('Add exercise', async (x) => { ex.push(x); draw(); }, { forPlan: true });
      sh.querySelector('#wsave').onclick = async () => { if (!ex.length) return toast('Add an exercise first');
        try { await api('/api/fitness/workouts/presets', { body: { name: sh.querySelector('#wn').value || 'Workout', exercises: ex } }); close(); toast('Saved'); after(); } catch (e) { toast(e.message); } };
    });
  }

  F.routes.fitness = watch;
  F.routes.food = food;
  F.routes.workouts = workouts;
})();
