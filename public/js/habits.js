/* Habit tracker UI. Strength, not streaks; misses are blank, never red; rest days are planned. */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const DOT = { done: 'var(--moss)', mini: '#a9cf95', skip: '#cfd8e3' };

  function habitCard(h, showWeeks) {
    const done = h.today === 'done' || h.today === 'mini';
    return `<div class="card" data-h="${h.id}">
      <div class="row"><div class="grow"><b>${esc(h.title)}</b>
        <div class="small muted">${h.anchor ? `After ${esc(h.anchor)}, ` : ''}${h.tiny ? `I will ${esc(h.tiny)}` : ''}</div></div>
        <button class="btn ghost" data-edit="${h.id}" aria-label="Edit">⋯</button></div>
      <div class="row" style="margin:10px 0 6px"><div class="grow"><div class="energy" style="height:10px"><div style="width:${h.strength}%;background:linear-gradient(90deg,#9cc987,var(--moss))"></div></div></div>
        <span class="small muted" style="width:96px;text-align:right">strength ${h.strength}%</span></div>
      <div class="row small muted"><span class="grow">${h.thisWeek}/${h.per_week} this week${showWeeks && h.weeksOnTarget ? ` · ${h.weeksOnTarget} week${h.weeksOnTarget === 1 ? '' : 's'} on target` : ''}</span>
        <span aria-label="Last 14 days">${h.last14.map((d) => `<span title="${d.day}" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:2px;background:${DOT[d.status] || 'var(--line)'}"></span>`).join('')}</span></div>
      ${h.status === 'building' ? `<div class="row" style="margin-top:10px">
        <button class="btn ${done ? '' : 'secondary'} grow" data-log="done">${h.today === 'done' ? '✓ Done' : 'Done'}</button>
        <button class="btn ${h.today === 'mini' ? '' : 'secondary'}" data-log="mini" title="The tiny version counts in full">${h.today === 'mini' ? '✓ Mini' : 'Mini'}</button>
        <button class="btn ${h.today === 'skip' ? '' : 'ghost'}" data-log="skip" title="A planned rest day — not a miss">${h.today === 'skip' ? '✓ Rest' : 'Rest day'}</button></div>
        ${!h.yesterday ? `<button class="btn ghost small" data-yday="1" style="margin-top:4px">Did it yesterday? Tap to add</button>` : ''}`
      : `<button class="btn secondary block" data-swap="${h.id}" style="margin-top:10px">Start building this one</button>`}
      ${h.pair_with ? `<div class="small muted" style="margin-top:6px">🎧 Pair it with: ${esc(h.pair_with)}</div>` : ''}</div>`;
  }

  async function habits() {
    F.setTab('home');
    const d = await api('/api/habits');
    const building = d.habits.filter((h) => h.status === 'building');
    const parked = d.habits.filter((h) => h.status === 'parked');
    const showWeeks = F.state?.user?.settings?.streaks_enabled !== false;
    $app.innerHTML = `<a href="#home" class="btn ghost" style="padding-left:0">‹ Home</a>
      <div class="row"><h1 class="grow">Habits</h1><button class="btn" id="add">+ New</button></div>
      <p class="small muted" style="margin-top:4px">Habits take about two months to stick, and a missed day barely matters. Build ${d.maxBuilding} at most at once — small and anchored to something you already do.</p>
      ${d.freshStart && building.length ? '<div class="banner small">🌅 Fresh start — new week. The mini version counts in full.</div>' : ''}
      ${building.length ? building.map((h) => habitCard(h, showWeeks)).join('') : '<div class="card"><p class="muted">No habits yet. Start with one tiny thing anchored to your day — “After I pour my coffee, I take my meds.”</p></div>'}
      ${parked.length ? `<h2 style="margin-top:18px">Parking lot</h2><p class="small muted">Saved for later, so they’re not on your mind.</p>${parked.map((h) => habitCard(h, false)).join('')}` : ''}`;
    document.getElementById('add').onclick = () => habitSheet(null, building.length >= d.maxBuilding);
    $app.querySelectorAll('[data-h]').forEach((card) => {
      const id = card.dataset.h;
      card.querySelectorAll('[data-log]').forEach((b) => b.onclick = async () => {
        const h = d.habits.find((x) => x.id === id);
        const status = h.today === b.dataset.log ? 'clear' : b.dataset.log;
        const r = await api(`/api/habits/${id}/log`, { body: { status } });
        if (r.energy) F.afterEnergy(r.energy, '+3 energy'); else habits();
        if (status === 'mini') toast('The mini version counts. 🌱');
      });
      card.querySelector('[data-yday]')?.addEventListener('click', async () => {
        const y = new Date(d.today + 'T12:00:00Z'); y.setUTCDate(y.getUTCDate() - 1);
        await api(`/api/habits/${id}/log`, { body: { status: 'done', day: y.toISOString().slice(0, 10) } }); toast('Added for yesterday'); habits();
      });
      card.querySelector('[data-edit]')?.addEventListener('click', () => habitSheet(d.habits.find((x) => x.id === id)));
      card.querySelector('[data-swap]')?.addEventListener('click', async () => {
        if (building.length >= d.maxBuilding) return toast(`Park one of your ${d.maxBuilding} first — fewer habits stick better`);
        await api(`/api/habits/${id}/status`, { body: { status: 'building' } }); habits();
      });
    });
  }

  async function habitSheet(h, overCap) {
    let trackers = [];
    try { trackers = (await api('/api/sober')).trackers; } catch (_) {}
    let per = h?.per_week || 4;
    const days = new Set(h?.remind_days || [0, 1, 2, 3, 4, 5, 6]);
    sheet(`<h1>${h ? 'Edit habit' : 'New habit'}</h1>
      ${overCap && !h ? '<p class="small banner">You already have 3 building — this one will go in the parking lot until you swap.</p>' : ''}
      <div class="field"><label for="ht">Name</label><input id="ht" maxlength="60" value="${esc(h?.title || '')}" placeholder="e.g. Meds with coffee"></div>
      <div class="field"><label for="ha">After I… <span class="muted small">(something you already do every day)</span></label><input id="ha" maxlength="120" value="${esc(h?.anchor || '')}" placeholder="pour my morning coffee"></div>
      <div class="field"><label for="hy">…I will <span class="muted small">(the tiny version — under 2 minutes)</span></label><input id="hy" maxlength="120" value="${esc(h?.tiny || '')}" placeholder="take my tablet with it"></div>
      <div class="field"><label>How many days a week?</label><div class="row">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button class="chip ${n === per ? 'on' : ''}" data-per="${n}">${n}</button>`).join('')}</div>
        <p class="small muted" style="margin:.4em 0 0">Flexible targets stick better than “every day”.</p></div>
      <div class="field"><label for="hr">Reminder (optional)</label><input id="hr" type="time" value="${esc(h?.remind_at || '')}">
        <div class="row" style="margin-top:6px">${DAYS.map((x, i) => `<button class="chip ${days.has(i) ? 'on' : ''}" data-d="${i}">${x}</button>`).join('')}</div></div>
      <details><summary class="small"><b>If something gets in the way…</b> (optional, but it helps)</summary>
        <div class="field"><label for="hb">If…</label><input id="hb" maxlength="120" value="${esc(h?.barrier || '')}" placeholder="I’ve already left the kitchen"></div>
        <div class="field"><label for="hk">…then I’ll</label><input id="hk" maxlength="120" value="${esc(h?.backup || '')}" placeholder="take it at lunch instead"></div>
        <div class="field"><label for="hp">Pair it with something you enjoy</label><input id="hp" maxlength="120" value="${esc(h?.pair_with || '')}" placeholder="only listen to my podcast while I walk"></div>
        ${trackers.length ? `<div class="field"><label for="hi">An “instead” habit for…</label><select id="hi"><option value="">—</option>${trackers.map((t) => `<option value="${t.id}" ${h?.instead_for === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>` : ''}</details>
      <button class="btn block" id="save" style="margin-top:12px">Save</button>
      ${h ? `<div class="row" style="margin-top:8px"><button class="btn ghost grow" id="park">${h.status === 'parked' ? 'Start building' : 'Park it'}</button><button class="btn ghost grow" id="arch">Archive</button></div>` : ''}`, (sh, close) => {
      sh.querySelectorAll('[data-per]').forEach((b) => b.onclick = () => { per = +b.dataset.per; sh.querySelectorAll('[data-per]').forEach((x) => x.classList.toggle('on', x === b)); });
      sh.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { const i = +b.dataset.d; days.has(i) ? days.delete(i) : days.add(i); b.classList.toggle('on'); });
      const v = (id) => sh.querySelector(id)?.value || '';
      sh.querySelector('#save').onclick = async () => {
        const body = { title: v('#ht'), anchor: v('#ha'), tiny: v('#hy'), per_week: per, remind_at: v('#hr'), remind_days: [...days],
          barrier: v('#hb'), backup: v('#hk'), pair_with: v('#hp'), instead_for: v('#hi') };
        try { const r = await api(h ? `/api/habits/${h.id}` : '/api/habits', { method: h ? 'PUT' : 'POST', body }); close(); if (r.note) toast(r.note, 4000); habits(); }
        catch (e) { toast(e.message); }
      };
      sh.querySelector('#park')?.addEventListener('click', async () => { await api(`/api/habits/${h.id}/status`, { body: { status: h.status === 'parked' ? 'building' : 'parked' } }); close(); habits(); });
      sh.querySelector('#arch')?.addEventListener('click', async () => { if (confirm('Archive this habit? Its history is kept.')) { await api(`/api/habits/${h.id}/status`, { body: { status: 'archived' } }); close(); habits(); } });
    });
  }

  F.routes.habits = habits;
})();
