/*
 * Family → Calendar: the household's shared dates. Every adult sees and edits it.
 * Month grid (tap a day to jump to it, or to add on that day) + the month's list + an add form.
 */
(function () {
  const { api, esc, toast, sheet } = F;
  const A = '/api/family/calendar/events';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let y, m;   // month on screen (0-based month)
  const iso = (yy, mm, dd) => `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const todayIso = () => new Date().toLocaleDateString('en-CA');
  const longDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const covers = (e, d) => e.starts_on <= d && (e.ends_on || e.starts_on) >= d;

  async function draw(el) {
    if (y === undefined) { const t = todayIso().split('-'); y = +t[0]; m = +t[1] - 1; }
    const days = new Date(y, m + 1, 0).getDate();
    const from = iso(y, m, 1), to = iso(y, m, days);
    let events = [];
    try { events = (await api(`${A}?from=${from}&to=${to}`)).events; }
    catch (e) { el.innerHTML = `<p class="muted">Couldn’t load the calendar: ${esc(e.message)}</p>`; return; }
    const today = todayIso();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;   // Monday first
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<div></div>');
    for (let d = 1; d <= days; d++) {
      const di = iso(y, m, d);
      const n = events.filter((e) => covers(e, di)).length;
      cells.push(`<button type="button" class="cal-cell${di === today ? ' is-today' : ''}${n ? ' has' : ''}" data-day="${di}" aria-label="${esc(longDate(di))}${n ? `, ${n} thing${n > 1 ? 's' : ''}` : ''}">
        <span class="cal-num">${d}</span><span class="cal-dots">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`);
    }
    // The list: one heading per day that has something, multi-day events listed on their first day in this month.
    const byDay = {};
    for (const e of events) { const d = e.starts_on < from ? from : e.starts_on; (byDay[d] = byDay[d] || []).push(e); }
    const list = Object.keys(byDay).sort().map((d) => `<h3 class="cal-date${d === today ? ' is-today' : ''}" id="cal-${d}">${esc(longDate(d))}</h3>
      ${byDay[d].map((e) => `<div class="card cal-event" data-id="${e.id}">
        <div class="cal-time">${e.start_time ? esc(e.start_time + (e.end_time ? `–${e.end_time}` : '')) : 'All day'}</div>
        <div class="grow"><b>${esc(e.title)}</b><div class="small muted">${[e.ends_on && e.ends_on !== e.starts_on ? `until ${esc(shortDate(e.ends_on))}` : '',
    e.notes ? esc(e.notes) : '', e.created_by_name ? `added by ${esc(e.created_by_name)}` : '', e.source && e.source !== 'manual' ? esc(e.source) : ''].filter(Boolean).join(' · ')}</div></div>
        <button class="btn ghost" data-edit="${e.id}" aria-label="Change ${esc(e.title)}">✎</button></div>`).join('')}`).join('');

    el.innerHTML = `<h1>📅 Calendar</h1>
      <div class="card"><div class="row cal-head"><button class="btn ghost" id="calPrev" aria-label="Previous month">‹</button>
        <b class="grow center">${MONTHS[m]} ${y}</b><button class="btn ghost" id="calNext" aria-label="Next month">›</button></div>
        <div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="cal-wd">${d}</div>`).join('')}${cells.join('')}</div>
        ${y !== +today.slice(0, 4) || m !== +today.slice(5, 7) - 1 ? '<button class="btn ghost small" id="calToday">Back to this month</button>' : ''}</div>
      <button class="btn block" id="calAdd">+ Add something</button><div style="height:12px"></div>
      ${list || '<p class="muted center">Nothing this month yet.</p>'}`;
    el.querySelector('#calPrev').onclick = () => { m--; if (m < 0) { m = 11; y--; } draw(el); };
    el.querySelector('#calNext').onclick = () => { m++; if (m > 11) { m = 0; y++; } draw(el); };
    el.querySelector('#calToday')?.addEventListener('click', () => { y = undefined; draw(el); });
    el.querySelector('#calAdd').onclick = () => edit(el, null, today >= from && today <= to ? today : from);
    el.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => {
      const t = el.querySelector(`#cal-${b.dataset.day}`);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); else edit(el, null, b.dataset.day);
    });
    el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => edit(el, events.find((e) => e.id === b.dataset.edit)));
  }

  function edit(el, ev, day) {
    const e = ev || { title: '', starts_on: day, ends_on: null, start_time: null, end_time: null, notes: '' };
    sheet(`<h1>${ev ? 'Change' : 'Add to the calendar'}</h1>
      <div class="field"><label for="ct">What</label><input id="ct" maxlength="200" value="${esc(e.title)}"></div>
      <div class="row"><div class="field grow"><label for="cd">Day</label><input id="cd" type="date" value="${esc(e.starts_on)}"></div>
        <div class="field grow"><label for="ce">Until (optional)</label><input id="ce" type="date" value="${esc(e.ends_on || '')}"></div></div>
      <div class="row"><div class="field grow"><label for="cs">Starts (blank = all day)</label><input id="cs" type="time" value="${esc(e.start_time || '')}"></div>
        <div class="field grow"><label for="cf">Ends</label><input id="cf" type="time" value="${esc(e.end_time || '')}"></div></div>
      <div class="field"><label for="cn">Notes</label><input id="cn" maxlength="1000" value="${esc(e.notes || '')}"></div>
      <button class="btn block" id="ok">${ev ? 'Save' : 'Add'}</button>
      ${ev ? '<div style="height:8px"></div><button class="btn ghost block" id="rm">Remove from the calendar</button>' : ''}`, (sh, close) => {
      const v = (id) => sh.querySelector(id).value.trim();
      sh.querySelector('#ok').onclick = async () => {
        const body = { title: v('#ct'), starts_on: v('#cd'), ends_on: v('#ce') || null, start_time: v('#cs') || null, end_time: v('#cf') || null, notes: v('#cn') };
        if (!body.title || !body.starts_on) return toast('A title and a day, please');
        try {
          await api(ev ? `${A}/${ev.id}/update` : A, { body });
          close(); toast(ev ? 'Saved' : 'Added');
          const t = body.starts_on.split('-'); y = +t[0]; m = +t[1] - 1;
          draw(el);
        } catch (err) { toast(err.message); }
      };
      sh.querySelector('#rm')?.addEventListener('click', async () => {
        if (!confirm(`Remove “${ev.title}”?`)) return;
        try { await api(`${A}/${ev.id}/remove`, { body: {} }); close(); toast('Removed'); draw(el); } catch (err) { toast(err.message); }
      });
    });
  }

  F.family.section({ id: 'calendar', emoji: '📅', name: 'Calendar', sub: 'Shared dates for the grown-ups', order: 10, render: (el) => draw(el) });
})();
