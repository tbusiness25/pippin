/*
 * Sobriety / addiction tracker UI. The headline counts free days KEPT and never goes down.
 * A drink is a lapse with a debrief — no reset button exists. Research: docs/research/reports/Habit and sobriety tracker design.md
 */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  let content = null;
  const getContent = async () => (content = content || await api('/api/sober/content'));
  const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const REASONS = ['Sleep properly', 'Be fully present for the kids', 'Clearer head for the business', 'My ADHD meds work better without it', 'Save money', 'Feel healthier', 'Prove to myself I can', 'Better mornings', 'Less anxiety'];
  const termFor = (t) => (t.category === 'alcohol' ? 'alcohol-free' : 'free');

  // ---------- main page ----------
  async function sober(sub = '') {
    F.setTab('home');
    const { trackers, today } = await api('/api/sober');
    if (sub === 'new' || !trackers.length) return setup();
    const t = trackers.find((x) => x.id === sub) || trackers[0];
    const pct = Math.min(100, Math.round((t.free / t.target_days) * 100));
    const free = termFor(t);
    $app.innerHTML = `<a href="#home" class="btn ghost" style="padding-left:0">‹ Home</a>
      ${trackers.length > 1 ? `<div class="tabs2">${trackers.map((x) => `<a class="chip ${x.id === t.id ? 'on' : ''}" href="#sober/${x.id}" style="text-decoration:none">${x.emoji} ${esc(x.label)}</a>`).join('')}<a class="chip" href="#sober/new" style="text-decoration:none">+ Add</a></div>` : ''}
      ${t.emergency ? `<div class="card small" style="background:#fbe9e4;border:2px solid #e8a090">⚠️ <b>First days:</b> ${esc(t.emergency)} <a href="tel:999"><b>Call 999</b></a></div>` : ''}
      <div class="card center">
        <div class="small muted">${esc(t.label)}</div>
        ${t.started ? `<div style="font-family:var(--display);font-size:3.2rem;font-weight:700;line-height:1.1;margin-top:6px">${t.free}</div>
          <div><b>${free} day${t.free === 1 ? '' : 's'}</b> <span class="muted">of ${t.target_days}</span></div>
          <div class="energy" style="margin:12px 0 4px"><div style="width:${pct}%;background:linear-gradient(90deg,#9cc987,var(--moss))"></div></div>
          <div class="small muted">Day ${t.elapsed} since you started on ${fmtDate(t.start_date)}${t.show_run && t.run ? ` · current run ${t.run}` : ''}</div>`
          : `<div style="font-family:var(--display);font-size:2.4rem;font-weight:700;margin-top:6px">${t.daysUntilStart === 1 ? 'Tomorrow' : `${t.daysUntilStart} days`}</div><div class="muted">until day one — ${fmtDate(t.start_date)}</div>`}
      </div>
      ${t.started ? todayCard(t, today) : ''}
      ${t.unlogged.length ? `<div class="card"><b>Fill in the gaps?</b> <span class="small muted">No judgement — honest logging is what makes this work.</span>
        ${t.unlogged.map((d) => `<div class="row" style="margin-top:8px"><span class="grow small">${fmtDate(d)}</span><button class="btn secondary" data-fill="${d}" data-st="free">✓ ${free}</button><button class="btn ghost" data-fill="${d}" data-st="lapse">Had a drink</button></div>`).join('')}</div>` : ''}
      <button class="btn warm block" id="urge" style="font-size:1.1rem;min-height:58px">🌊 I’m having an urge</button><div style="height:14px"></div>
      ${t.supportSuggested ? `<div class="card small" style="background:var(--bg)">💛 It’s been a bumpy fortnight. That’s really common, and extra support helps a lot of people: ${t.helplines.slice(0, 3).map((h) => `<a href="${esc(h.href)}">${esc(h.name)}</a>`).join(', ')}, or your GP. <a href="#coach/flow/lapse">Talk it through</a>.</div>` : ''}
      ${t.rescreenDue ? `<div class="card small">📋 You’re at a good point to re-take the short alcohol check and see how things have changed. <button class="btn secondary" id="rescreen">Re-check</button></div>` : ''}
      <div class="card"><div class="row"><h2 class="grow">Coming up</h2><button class="btn ghost" id="addEv">+ Event</button></div>
        <p class="small muted" style="margin-top:-4px">Parties, work dos, Friday nights. A plan made beforehand is one of the best-evidenced things you can do — refresh it before each one.</p>
        ${t.events.length ? t.events.map((e) => `<div class="friend" data-ev="${e.id}" style="cursor:pointer"><div class="grow"><b>${esc(e.title)}</b><div class="small muted">${e.on_date ? fmtDate(String(e.on_date).slice(0, 10)) : 'whenever it comes up'}${e.drink ? ` · drinking: ${esc(e.drink)}` : ''}</div></div><span>›</span></div>`).join('') : '<p class="small muted">Nothing yet.</p>'}
        <a class="btn ghost block" href="#coach/flow/event">💬 Plan one with my coach</a></div>
      ${t.started ? `<div class="card"><h2>Your year</h2><div id="cal" style="overflow-x:auto"></div>
        <div class="small muted" style="margin-top:6px"><span style="color:var(--moss)">■</span> ${free} · <span style="color:#e8b46a">■</span> drink day · <span style="color:var(--line)">■</span> not logged</div></div>` : ''}
      ${(t.saved.money || t.saved.units || t.saved.kcal) ? `<div class="card"><h2>So far</h2><div class="grid">
        ${t.saved.money ? `<div class="tile" style="min-height:0"><b style="font-size:1.4rem">£${t.saved.money}</b><span class="small muted">not spent</span></div>` : ''}
        ${t.saved.units ? `<div class="tile" style="min-height:0"><b style="font-size:1.4rem">${t.saved.units}</b><span class="small muted">${esc(t.unit)} not had</span></div>` : ''}
        ${t.saved.kcal ? `<div class="tile" style="min-height:0"><b style="font-size:1.4rem">${t.saved.kcal.toLocaleString()}</b><span class="small muted">kcal not drunk</span></div>` : ''}</div></div>` : ''}
      ${t.benefits.length || t.nextMilestone ? `<div class="card">${t.benefits.map((b) => `<p class="small">🌱 ${esc(b.text)}</p>`).join('')}${t.nextMilestone ? `<p class="small muted">Next milestone: ${t.nextMilestone} ${free} days.</p>` : ''}</div>` : ''}
      ${t.reasons.length ? `<div class="card"><h2>Why I’m doing this</h2>${t.reasons.map((r) => `<div>• ${esc(r)}</div>`).join('')}</div>` : ''}
      <div class="card"><h2>Support</h2>${t.note ? `<p class="small">${esc(t.note)}</p>` : ''}${t.helplines.map((h) => `<div class="small" style="margin:.35em 0">${h.href ? `<a href="${esc(h.href)}"><b>${esc(h.name)}</b></a>` : `<b>${esc(h.name)}</b>`} — ${esc(h.detail)}</div>`).join('')}</div>
      <div class="row"><button class="btn ghost grow" id="settings">⚙️ Settings</button><a class="btn ghost grow" href="#sober/new" style="text-align:center;text-decoration:none">+ Track something else</a></div>`;

    bindToday(t);
    $app.querySelectorAll('[data-fill]').forEach((b) => b.onclick = async () => {
      if (b.dataset.st === 'lapse') return lapseSheet(t, b.dataset.fill);
      await api(`/api/sober/${t.id}/day`, { body: { day: b.dataset.fill, status: 'free' } }); sober(t.id);
    });
    document.getElementById('urge').onclick = () => urgeSheet(t);
    document.getElementById('addEv').onclick = () => eventSheet(t, null);
    $app.querySelectorAll('[data-ev]').forEach((r) => r.onclick = () => eventSheet(t, t.events.find((e) => e.id === r.dataset.ev)));
    document.getElementById('settings').onclick = () => settingsSheet(t);
    document.getElementById('rescreen')?.addEventListener('click', () => screenSheet(async () => sober(t.id), t.id));
    if (t.started) drawCalendar(t);
  }

  function todayCard(t, today) {
    const free = termFor(t);
    if (t.today === 'free') return `<div class="card center">✅ Today’s logged as ${free}. ${t.pledgedToday ? '' : ''}<button class="btn ghost small" data-undo="1">change</button></div>`;
    if (t.today === 'lapse') return `<div class="card center small">Today’s logged as a drink day. Your ${free} days all still count. Tomorrow is a normal day. <a href="#coach/flow/lapse">Talk it through</a></div>`;
    const hour = new Date().getHours();
    return `<div class="card"><h2>Today</h2>
      ${!t.pledgedToday && hour < 17 ? `<button class="btn secondary block" id="pledge">🤝 I’m not drinking today</button><div style="height:8px"></div>` : (t.pledgedToday ? '<p class="small muted">✓ Pledged this morning.</p>' : '')}
      <div class="row"><button class="btn grow" id="free">✓ ${free} today</button><button class="btn ghost" id="lapse">I had a drink</button></div>
      <p class="small muted" style="margin:.5em 0 0">Log tonight — or tomorrow morning.</p></div>`;
  }
  function bindToday(t) {
    document.getElementById('pledge')?.addEventListener('click', async () => { await api(`/api/sober/${t.id}/pledge`, { body: {} }); toast('One day at a time. 🌱'); sober(t.id); });
    document.getElementById('free')?.addEventListener('click', async () => {
      const r = await api(`/api/sober/${t.id}/day`, { body: { status: 'free' } });
      if (r.milestone) celebrate(t, r.milestone); else toast(`Another ${termFor(t)} day. 🌱`);
      if (r.energy?.started) F.afterEnergy(r.energy); else sober(t.id);
    });
    document.getElementById('lapse')?.addEventListener('click', () => lapseSheet(t));
    $app.querySelector('[data-undo]')?.addEventListener('click', () => lapseSheet(t));
  }

  function celebrate(t, m) {
    sheet(`<div class="center">${window.sprigOf(F.state.pet, { mood: 'excited', size: 130 })}<h1>${m.days} ${termFor(t)} day${m.days === 1 ? '' : 's'}!</h1>
      <p>Every one of those is yours to keep. +${m.acorns} 🌰</p><button class="btn block" id="ok">🎉</button></div>`, (sh, close) => sh.querySelector('#ok').onclick = () => { close(); sober(t.id); });
  }

  async function drawCalendar(t) {
    const { days } = await api(`/api/sober/${t.id}/calendar`);
    const map = Object.fromEntries(days.map((d) => [d.day, d.status]));
    const start = new Date(t.start_date + 'T12:00:00Z');
    const weeks = Math.ceil(t.target_days / 7);
    const today = new Date().toISOString().slice(0, 10);
    let cells = '';
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setUTCDate(dt.getUTCDate() + w * 7 + d);
      const k = dt.toISOString().slice(0, 10);
      const fill = map[k] === 'free' ? 'var(--moss)' : map[k] === 'lapse' ? '#e8b46a' : k <= today ? 'var(--line)' : 'transparent';
      cells += `<rect x="${w * 11}" y="${d * 11}" width="9" height="9" rx="2" fill="${fill}" stroke="${k > today ? 'var(--line)' : 'none'}" stroke-width="0.6"><title>${k}</title></rect>`;
    }
    const el = document.getElementById('cal');
    if (el) el.innerHTML = `<svg width="${weeks * 11}" height="77" role="img" aria-label="Year calendar">${cells}</svg>`;
  }

  // ---------- urge surfing ----------
  async function urgeSheet(t) {
    const c = await getContent();
    let before = 6, after = null;
    const trig = new Set();
    let habits = [];
    try { habits = (await api('/api/habits')).habits.filter((h) => h.instead_for === t.id || h.status === 'building').slice(0, 3); } catch (_) {}
    sheet(`<h1>🌊 Ride the wave</h1><p class="muted">Urges rise, peak and pass — usually within 20–30 minutes. You don’t have to act on this one.</p>
      <div class="field"><label>How strong is it right now? <b id="bv">6</b>/10</label><input type="range" min="0" max="10" value="6" id="before"></div>
      <div class="field"><label>What’s going on?</label><div class="row wrap">${c.triggers.map((x) => `<button class="chip" data-t="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
      <div class="card center" style="background:var(--bg)"><div class="breath" id="orb" style="width:150px;height:150px;margin:8px auto">Start</div>
        <button class="btn secondary" id="go">Breathe with me — 3 minutes</button>
        <p class="small muted" id="cue" style="margin-top:8px">Notice where you feel it. Don’t fight it — watch it like a wave.</p></div>
      ${t.reasons.length ? `<div class="card small"><b>Your reasons</b>${t.reasons.map((r) => `<div>• ${esc(r)}</div>`).join('')}</div>` : ''}
      ${habits.length ? `<div class="card small"><b>Instead, you could…</b>${habits.map((h) => `<div>• ${esc(h.tiny || h.title)}</div>`).join('')}</div>` : ''}
      <div class="field"><label>How strong is it now? <b id="av">–</b>/10</label><input type="range" min="0" max="10" value="5" id="after"></div>
      <div class="row"><button class="btn grow" id="passed">It passed 🌊</button><button class="btn ghost" id="still">Still strong</button></div>
      <a class="btn ghost block" href="#coach/flow/urge" id="talk">💬 Talk it through with my coach</a>`, (sh, close) => {
      sh.querySelector('#before').oninput = (e) => { before = +e.target.value; sh.querySelector('#bv').textContent = before; };
      sh.querySelector('#after').oninput = (e) => { after = +e.target.value; sh.querySelector('#av').textContent = after; };
      sh.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { trig.has(b.dataset.t) ? trig.delete(b.dataset.t) : trig.add(b.dataset.t); b.classList.toggle('on'); });
      let timer = null;
      sh.querySelector('#go').onclick = () => {
        if (timer) return;
        const orb = sh.querySelector('#orb'), cue = sh.querySelector('#cue');
        const cues = ['Notice where you feel it — chest, throat, hands.', 'Name it: “this is an urge.” It’s a feeling, not an order.', 'Watch it rise… it will peak.', 'Breathe out slowly. Let it be there.', 'Notice it changing — even slightly.', 'You’re surfing it. Nearly there.'];
        let s = 0, i = 0;
        const step = () => {
          const inhale = i % 2 === 0;
          orb.textContent = inhale ? 'In' : 'Out'; orb.style.transitionDuration = inhale ? '4s' : '6s'; orb.style.transform = inhale ? 'scale(1.3)' : 'scale(0.85)';
          if (i % 6 === 0) cue.textContent = cues[(i / 6) % cues.length];
          i++; s += inhale ? 4 : 6;
          if (s >= 180) { orb.textContent = 'Done'; orb.style.transform = 'scale(1)'; cue.textContent = 'How strong is it now?'; Sounds.chime(); timer = null; return; }
          timer = setTimeout(step, (inhale ? 4 : 6) * 1000);
        };
        step();
      };
      const save = async (outcome) => {
        clearTimeout(timer);
        const r = await api(`/api/sober/${t.id}/urge`, { body: { before, after, triggers: [...trig], outcome } });
        close(); F.showMessages(r.messages);
        if (outcome !== 'passed') toast('Logged. Want to talk it through? Your coach is one tap away.', 4000);
      };
      sh.querySelector('#passed').onclick = () => save('passed');
      sh.querySelector('#still').onclick = () => save('unsure');
      sh.querySelector('#talk').onclick = () => { clearTimeout(timer); api(`/api/sober/${t.id}/urge`, { body: { before, triggers: [...trig], outcome: 'unsure' } }).catch(() => {}); close(); };
    });
  }

  // ---------- lapse debrief ----------
  async function lapseSheet(t, day) {
    const c = await getContent();
    const sit = new Set();
    const next = new Set();
    const NEXT = ['Water and food', 'An early night', 'Tell someone I trust', 'Clear any drink out of the house', 'Plan tomorrow evening'];
    sheet(`<h1>Thanks for logging it</h1><p>A drink day is information, not a verdict. <b>Your ${termFor(t)} days all still count.</b> A couple of quick questions help make next time easier — skip anything you like.</p>
      ${c.emergency && t.category === 'alcohol' ? `<p class="small muted">${esc(c.emergency)}</p>` : ''}
      <div class="field"><label>How much, roughly? <span class="muted small">(optional, ${esc(t.unit)})</span></label><input id="amt" type="number" min="0" step="0.5" inputmode="decimal"></div>
      <div class="field"><label>What was going on?</label><div class="row wrap">${c.triggers.map((x) => `<button class="chip" data-s="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <textarea id="what" placeholder="Where were you, who with, how were you feeling? (optional)" style="margin-top:8px"></textarea></div>
      <div class="field"><label>For the next 24 hours, what would help?</label><div class="row wrap">${NEXT.map((x) => `<button class="chip" data-n="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
      <div class="field"><label>Next time that situation comes up, I will…</label><input id="nt" maxlength="200" placeholder="e.g. order a lime and soda first, and leave by 10"></div>
      <button class="btn block" id="save">Save</button>
      <a class="btn ghost block" href="#coach/flow/lapse" id="talk">💬 Talk it through with my coach</a>`, (sh, close) => {
      sh.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { sit.has(b.dataset.s) ? sit.delete(b.dataset.s) : sit.add(b.dataset.s); b.classList.toggle('on'); });
      sh.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { next.has(b.dataset.n) ? next.delete(b.dataset.n) : next.add(b.dataset.n); b.classList.toggle('on'); });
      const save = async () => {
        const amount = sh.querySelector('#amt').value;
        const d = await api(`/api/sober/${t.id}/day`, { body: { day, status: 'lapse', amount: amount === '' ? null : Number(amount) } });
        const r = await api(`/api/sober/${t.id}/lapse`, { body: { day, amount: amount === '' ? null : Number(amount), situation: [...sit],
          what_happened: sh.querySelector('#what').value, next_24h: [...next].join('; '), next_time: sh.querySelector('#nt').value } });
        close();
        if (d.overdose) sheet(`<h1>⚠️ Please read</h1><p>${esc(d.overdose)}</p><a class="btn block" href="tel:999">Call 999</a><div style="height:8px"></div><button class="btn ghost block" id="ok">OK</button>`, (s2, c2) => s2.querySelector('#ok').onclick = c2);
        else toast(r.message, 5000);
        sober(t.id);
      };
      sh.querySelector('#save').onclick = save;
      sh.querySelector('#talk').onclick = () => { save().catch(() => {}); };
    });
  }

  // ---------- events ----------
  function eventSheet(t, e) {
    sheet(`<h1>${e ? 'Your plan' : 'Plan for an event'}</h1>
      <div class="field"><label for="et">What is it?</label><input id="et" maxlength="80" value="${esc(e?.title || '')}" placeholder="e.g. my 40th, work Christmas do"></div>
      <div class="field"><label for="ed">When?</label><input id="ed" type="date" value="${e?.on_date ? String(e.on_date).slice(0, 10) : ''}"></div>
      <div class="field"><label for="edr">What I’ll drink instead</label><input id="edr" maxlength="200" value="${esc(e?.drink || '')}" placeholder="lime and soda / alcohol-free G&T / Coke"></div>
      <div class="field"><label for="es">What I’ll say if someone offers</label><input id="es" maxlength="200" value="${esc(e?.script || '')}" placeholder="“I’m doing a year off — loving it actually”"></div>
      <div class="field"><label for="ex">How and when I’ll leave, or who’s got my back</label><input id="ex" maxlength="200" value="${esc(e?.exit || '')}" placeholder="Sam knows; I’ll head off by 10"></div>
      <div class="field"><label for="ep">Anything else</label><textarea id="ep">${esc(e?.plan || '')}</textarea></div>
      <p class="small muted">A note on alcohol-free beer/wine: it helps some people and triggers cravings in others — your call.</p>
      <button class="btn block" id="save">${e ? 'Update plan' : 'Save plan'}</button>${e ? '<button class="btn ghost block" id="del">Delete</button>' : ''}`, (sh, close) => {
      const v = (id) => sh.querySelector(id).value;
      sh.querySelector('#save').onclick = async () => {
        const body = { title: v('#et'), on_date: v('#ed'), drink: v('#edr'), script: v('#es'), exit: v('#ex'), plan: v('#ep') };
        try { await api(e ? `/api/sober/${t.id}/events/${e.id}` : `/api/sober/${t.id}/events`, { method: e ? 'PUT' : 'POST', body }); close(); toast('Plan saved'); sober(t.id); }
        catch (err) { toast(err.message); }
      };
      sh.querySelector('#del')?.addEventListener('click', async () => { await api(`/api/sober/${t.id}/events/${e.id}`, { method: 'DELETE' }); close(); sober(t.id); });
    });
  }

  // ---------- settings ----------
  function settingsSheet(t) {
    const st = F.state.user.settings || {};
    sheet(`<h1>Settings</h1>
      <div class="field"><label for="sl">Name</label><input id="sl" maxlength="60" value="${esc(t.label)}"></div>
      <div class="field"><label for="sr">My reasons (one per line)</label><textarea id="sr">${esc(t.reasons.join('\n'))}</textarea></div>
      <div class="field"><label>What I used to spend / have per week <span class="small muted">(for the “so far” numbers)</span></label>
        <div class="row"><input id="bs" type="number" min="0" placeholder="£" value="${t.baseline.spend ?? ''}"><input id="bu" type="number" min="0" placeholder="${esc(t.unit)}" value="${t.baseline.units ?? ''}">${t.category === 'binge' ? '' : `<input id="bk" type="number" min="0" placeholder="kcal" value="${t.baseline.kcal ?? ''}">`}</div></div>
      <label class="row"><input type="checkbox" id="run" style="width:22px;height:22px" ${t.show_run ? 'checked' : ''}><span>Also show my current run <span class="small muted">(off by default — total days is the number that counts)</span></span></label>
      <label class="row" style="margin-top:8px"><input type="checkbox" id="disc" style="width:22px;height:22px" ${t.discreet ? 'checked' : ''}><span>Discreet — don’t name it on the home screen</span></label>
      <div class="row" style="margin-top:12px"><div class="grow field"><label for="pt">Morning pledge</label><input type="time" id="pt" value="${esc(st.pledge_time || '08:30')}"></div>
        <div class="grow field"><label for="ct">Evening check-in</label><input type="time" id="ct" value="${esc(st.sober_time || '21:00')}"></div></div>
      <button class="btn block" id="save">Save</button><button class="btn ghost block" id="arch">Stop tracking this</button>`, (sh, close) => {
      sh.querySelector('#save').onclick = async () => {
        const n = (id) => { const x = sh.querySelector(id); return x && x.value !== '' ? Number(x.value) : undefined; };
        await api(`/api/sober/${t.id}`, { method: 'PUT', body: { label: sh.querySelector('#sl').value, reasons: sh.querySelector('#sr').value.split('\n').map((x) => x.trim()).filter(Boolean),
          show_run: sh.querySelector('#run').checked, discreet: sh.querySelector('#disc').checked, baseline: { spend: n('#bs'), units: n('#bu'), kcal: n('#bk') } } });
        await api('/api/push/settings', { body: { pledge_time: sh.querySelector('#pt').value, sober_time: sh.querySelector('#ct').value } });
        await F.refresh(); close(); toast('Saved'); sober(t.id);
      };
      sh.querySelector('#arch').onclick = async () => { if (confirm('Stop tracking? Your history is kept.')) { await api(`/api/sober/${t.id}/archive`, { body: {} }); close(); location.hash = '#home'; } };
    });
  }

  // ---------- AUDIT screening ----------
  async function screenSheet(done, trackerId) {
    const c = await getContent();
    const answers = [];
    let qi = 0;
    let phase = 'audit', needFull = false;
    sheet('<div id="scr"></div>', (sh, close) => {
      const el = sh.querySelector('#scr');
      const drawQ = () => {
        const max = needFull ? 10 : 3;
        const q = c.audit[qi];
        el.innerHTML = `<h1>A quick alcohol check</h1><p class="small muted">The standard UK questions (AUDIT). It’s a screen, not a diagnosis — and it helps make sure stopping is safe for you.</p>
          <div class="progress"><div style="width:${(qi / max) * 100}%"></div></div><h2>${esc(q.q)}</h2>${q.hint ? `<p class="small muted">${esc(q.hint)}</p>` : ''}
          ${q.o.map(([label], i) => `<button class="opt" data-o="${i}">${esc(label)}</button>`).join('')}`;
        el.querySelectorAll('[data-o]').forEach((b) => b.onclick = async () => {
          answers[qi] = +b.dataset.o; qi++;
          if (qi === 3 && !needFull) {
            const r = await api('/api/sober/screen', { body: { answers: answers.slice(0, 3) } });
            if (r.needFull) { needFull = true; return drawQ(); }
            return drawW();
          }
          if (qi < (needFull ? 10 : 3)) return drawQ();
          drawW();
        });
      };
      const drawW = () => {
        // Same safety note for everyone — the score is shown as-is and never used to decide anything.
        el.innerHTML = '<p class="typing">Working out your score…</p>';
        (async () => {
          const r = await api('/api/sober/screen', { body: { answers: needFull ? answers : answers.slice(0, 3), tracker_id: trackerId } });
          const score = r.audit ?? r.auditc, sf = r.safety;
          el.innerHTML = `<h1>Your result</h1><div class="card center"><div class="bigtime">${score}</div><p>${r.audit != null ? 'AUDIT' : 'AUDIT-C'} — <b>${esc(r.audit != null ? r.auditBand : r.auditcBand)}</b></p>
              <p class="small muted">A screening score from the WHO questionnaire, not a diagnosis.</p></div>
            <div class="card" style="background:#fbe9e4;border:2px solid #e8a090"><b>${esc(sf.title)}</b><p>${esc(sf.intro)}</p>
              <ul>${sf.signs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p>${esc(sf.outro)}</p>
              ${r.helplines.map((h) => `<div class="small">${h.href ? `<a href="${esc(h.href)}"><b>${esc(h.name)}</b></a>` : `<b>${esc(h.name)}</b>`} — ${esc(h.detail)}</div>`).join('')}
              <p class="small muted">Source: ${esc(sf.source)}</p>
              <label class="row" style="margin-top:10px"><input type="checkbox" id="ack" style="width:22px;height:22px"><span>I’ve read this. If any of these apply to me, I’ll speak to my GP or an alcohol service before I stop.</span></label></div>
            <button class="btn block" id="cont">Continue</button>`;
          el.querySelector('#cont').onclick = () => {
            if (!el.querySelector('#ack').checked) return toast('Please tick to confirm you’ve read this');
            close(); done({ auditc: r.auditc, audit: r.audit, gate: r.gate, flags: [] }, true);
          };
        })().catch((e) => toast(e.message));
      };
      drawQ();
    });
  }

  // ---------- setup ----------
  async function setup() {
    F.setTab('home');
    const c = await getContent();
    $app.innerHTML = `<a href="#home" class="btn ghost" style="padding-left:0">‹ Home</a><h1>What would you like to change?</h1>
      <p class="muted">Track days free of something — or cutting down. Every free day counts and stays counted, whatever happens.</p>
      <div class="grid">${Object.entries(c.categories).map(([k, cat]) => `<button class="tile" data-cat="${k}"><span class="em">${cat.emoji}</span><b>${esc(cat.name)}</b></button>`).join('')}</div>
      <p class="small muted" style="margin-top:14px">Helplines last checked ${esc(c.helplinesChecked)} (UK).</p>`;
    $app.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => {
      const cat = c.categories[b.dataset.cat];
      if (cat.screen === 'audit') screenSheet((screening, ack) => details(b.dataset.cat, cat, screening, ack));
      else details(b.dataset.cat, cat, {}, false);
    });
  }

  function details(key, cat, screening, acknowledged) {
    const reasons = new Set();
    const nextSunday = (() => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
    let start = new Date().toISOString().slice(0, 10);
    let target = 365;
    const suggestions = key === 'alcohol' ? REASONS : ['Feel healthier', 'Save money', 'Be present for the people I love', 'Prove to myself I can', 'Better sleep'];
    $app.innerHTML = `<a href="#sober/new" class="btn ghost" style="padding-left:0">‹ Back</a><h1>${cat.emoji} ${esc(cat.name)}</h1>
      ${cat.note ? `<div class="card small" style="background:var(--bg)">${esc(cat.note)}</div>` : ''}
      ${cat.noQuitFlow ? `<label class="row card"><input type="checkbox" id="ack" style="width:22px;height:22px"><span>I understand I shouldn’t stop suddenly, and I’ll follow a plan from my GP or a drug service. ${APP} will track it with me.</span></label>` : ''}
      <div class="card">
        <div class="field"><label for="lb">Call it</label><input id="lb" maxlength="60" value="${key === 'alcohol' ? 'My alcohol-free year' : esc(cat.name + (cat.noQuitFlow ? ' — my plan' : '-free'))}"></div>
        <div class="field"><label>Day one</label><div class="row wrap"><button class="chip on" data-start="${start}">Today</button><button class="chip" data-start="${(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })()}">Tomorrow</button><button class="chip" data-start="${nextSunday}">Sunday</button><input type="date" id="sd" style="max-width:170px"></div></div>
        <div class="field"><label>Goal</label><div class="row wrap">${[[30, '30 days'], [90, '90 days'], [365, 'A year']].map(([n, l]) => `<button class="chip ${n === 365 ? 'on' : ''}" data-target="${n}">${l}</button>`).join('')}</div></div>
        <div class="field"><label>Why are you doing this? <span class="small muted">(you’ll see these when it’s hard)</span></label><div class="row wrap">${suggestions.map((r) => `<button class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
          <input id="own" placeholder="Your own reason" maxlength="120" style="margin-top:8px"></div>
        <div class="field"><label>Roughly what you spend / have per week <span class="small muted">(optional — for “money saved”)</span></label>
          <div class="row"><input id="bs" type="number" min="0" placeholder="£ per week"><input id="bu" type="number" min="0" placeholder="${esc(cat.unit)} per week"></div></div>
        <label class="row"><input type="checkbox" id="run" style="width:22px;height:22px"><span>Also show a “current run” <span class="small muted">— optional. The headline is always your total free days, which never goes down.</span></span></label>
        <button class="btn block" id="go" style="margin-top:14px">Start</button></div>`;
    $app.querySelectorAll('[data-start]').forEach((b) => b.onclick = () => { start = b.dataset.start; $app.querySelectorAll('[data-start]').forEach((x) => x.classList.toggle('on', x === b)); });
    document.getElementById('sd').onchange = (e) => { if (e.target.value) { start = e.target.value; $app.querySelectorAll('[data-start]').forEach((x) => x.classList.remove('on')); } };
    $app.querySelectorAll('[data-target]').forEach((b) => b.onclick = () => { target = +b.dataset.target; $app.querySelectorAll('[data-target]').forEach((x) => x.classList.toggle('on', x === b)); });
    $app.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { reasons.has(b.dataset.r) ? reasons.delete(b.dataset.r) : reasons.add(b.dataset.r); b.classList.toggle('on'); });
    document.getElementById('go').onclick = async () => {
      const own = document.getElementById('own').value.trim();
      if (own) reasons.add(own);
      const ack = acknowledged || !!document.getElementById('ack')?.checked;
      try {
        const r = await api('/api/sober', { body: { category: key, label: document.getElementById('lb').value, start_date: start, target_days: target,
          reasons: [...reasons], show_run: document.getElementById('run').checked, screening, acknowledged: ack,
          baseline: { spend: document.getElementById('bs').value || null, units: document.getElementById('bu').value || null } } });
        await F.refresh();
        location.hash = `#sober/${r.id}`;
      } catch (e) { toast(e.message); }
    };
  }

  F.routes.sober = sober;
})();
