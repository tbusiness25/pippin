/*
 * ✅ My jobs — the things that are yours to do each day, a plan for after school and the weekend (so you never
 * have to wonder what to play with), and the guide to growing up. (src/kids/jobs.js)
 */
(function () {
  const { esc, toast, sheet } = F;
  const K = () => F.kids;
  const SLOT_NAME = { morning: '🌅 Morning', after_school: '🏫 After school', bedtime: '🌙 Bedtime', weekly: '🧹 Weekends' };
  const SLOT_ORDER = ['morning', 'after_school', 'bedtime', 'weekly'];
  const PLAN_NAME = { after_school: '🏫 After school', weekend_am: '☀️ Weekend morning', weekend_pm: '🌤️ Weekend afternoon' };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const pill = (on, label, attrs) => `<button class="kj-pill ${on ? 'on' : ''}" ${attrs}>${label}</button>`;
  const dayLabel = (d) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  async function render(el, rest) {
    if (typeof kjTimer !== 'undefined') clearInterval(kjTimer);
    const tab = (rest || 'today').split('/')[0];
    const tabs = [['today', '✅ Today'], ['plan', '📅 My plan'], ['guide', '📖 The guide']];
    el.innerHTML = `<div class="kids kj">${K().header('My responsibilities', '✅')}
      <div class="kj-tabs">${tabs.map(([k, l]) => `<a class="kj-tab ${k === tab ? 'on' : ''}" href="#k/responsibilities/${k}">${l}</a>`).join('')}</div>
      <div id="kjBody"><p class="muted center">Loading…</p></div></div>`;
    const body = el.querySelector('#kjBody');
    if (tab === 'plan') return plan(body);
    if (tab === 'guide') return guide(body);
    return today(body);
  }

  // ---------------------------------------------------------------- today
  async function today(body, day) {
    const d = await K().api('/jobs' + (day ? `?day=${day}` : ''));
    const groups = SLOT_ORDER.map((s) => [s, d.jobs.filter((j) => j.slot === s)]).filter(([, l]) => l.length);
    const left = d.jobs.filter((j) => !j.done).length;
    body.innerHTML = `<p class="kj-day">${esc(dayLabel(d.day))}${d.school ? ' · school day' : ' · weekend'}</p>
      <div class="kj-progress"><div style="width:${d.jobs.length ? Math.round(((d.jobs.length - left) / d.jobs.length) * 100) : 0}%"></div></div>
      <p class="kj-count">${left ? `${left} to go — you’ve got this` : '✓ All done today. Brilliant!'}</p>
      ${groups.map(([s, list]) => `<h2 class="kj-h">${SLOT_NAME[s]}</h2>${list.map((j) => `<div class="kj-job ${j.done ? 'is-done' : ''}" data-id="${j.id}">
        <button class="kj-tick" data-tick="${j.id}" aria-pressed="${j.done}" aria-label="${j.done ? 'Not done' : 'Done'}: ${esc(j.title)}">${j.done ? '✓' : ''}</button>
        <div class="kj-mid"><div class="kj-title">${j.icon} ${esc(j.title)}</div>${j.detail ? `<div class="kj-detail">${esc(j.detail)}</div>` : ''}</div>
        ${j.timer_secs ? `<button class="kj-timer" data-timer="${j.timer_secs}" data-id="${j.id}" aria-label="Start the ${Math.round(j.timer_secs / 60)} minute timer">⏱ ${Math.round(j.timer_secs / 60)} min</button>` : ''}</div>`).join('')}`).join('')}
      ${!d.jobs.length ? '<p class="muted center">Nothing today. Enjoy it!</p>' : ''}`;
    body.querySelectorAll('[data-tick]').forEach((b) => { b.onclick = async () => {
      const id = b.dataset.tick; const now = b.getAttribute('aria-pressed') !== 'true';
      try { await K().api(`/jobs/${id}/done`, { body: { done: now, day: d.day } }); if (now && left <= 1) celebrate(); today(body, day); }
      catch (e) { toast(e.message); }
    }; });
    body.querySelectorAll('[data-timer]').forEach((b) => { b.onclick = () => timer(+b.dataset.timer, b.parentElement.querySelector('.kj-title').textContent); });
  }

  function celebrate() { if (F.showMessages) F.showMessages(['Every job done — you did it! 🎉']); if (window.Sounds && Sounds.chime) Sounds.chime(); }

  /** A countdown you can see — for two minutes of brushing teeth, for example. */
  function timer(secs, title) {
    clearInterval(kjTimer);
    const total = secs; let left = secs; let t = null;
    sheet(`<div class="center"><h1 style="font-size:1.2rem">${esc(title.replace(/^\S+\s/, ''))}</h1>
      <div class="kj-ring"><svg viewBox="0 0 120 120" width="200" height="200"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="12"/>
      <circle id="kjArc" cx="60" cy="60" r="52" fill="none" stroke="var(--moss)" stroke-width="12" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="326.7" stroke-dashoffset="0"/></svg>
      <div class="kj-clock" id="kjClock">${fmt(left)}</div></div>
      <p class="muted" id="kjMsg">Get ready…</p><button class="btn block big" id="kjGo">Start</button></div>`, (el, close) => {
      const clock = el.querySelector('#kjClock'), arc = el.querySelector('#kjArc'), msg = el.querySelector('#kjMsg'), go = el.querySelector('#kjGo');
      const draw = () => { clock.textContent = fmt(left); arc.setAttribute('stroke-dashoffset', String(326.7 * (1 - left / total))); };
      const tick = () => { left -= 1; draw(); if (left <= 0) { clearInterval(t); kjTimer = null; t = null; msg.textContent = '⭐ Time’s up — brilliant!'; go.textContent = 'Done'; go.onclick = close; if (window.Sounds && Sounds.chime) Sounds.chime(); } };
      go.onclick = () => { if (t) { clearInterval(t); t = null; go.textContent = 'Keep going'; return; } if (left <= 0) return close(); msg.textContent = 'Top, bottom, front, back, tongue…'; go.textContent = 'Pause'; t = setInterval(tick, 1000); kjTimer = t; };
      draw();
    });
  }
  let kjTimer = null;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------------------------------------------------------------- plan
  async function plan(body, week) {
    const p = await K().api('/plan' + (week ? `?week=${week}` : ''));
    body.innerHTML = `<p class="kj-day">Plan the week, so after school you never have to wonder.</p>
      <div class="kj-week">${p.days.map((d) => `<div class="kj-dayc ${d.day === p.today ? 'today' : ''}">
        <div class="kj-dn">${DAYS[(new Date(`${d.day}T12:00`).getDay() + 6) % 7]}<small>${new Date(`${d.day}T12:00`).getDate()}</small></div>
        ${d.slots.map((s) => { const it = s.item; return `<button class="kj-slot ${it ? (it.done ? 'done' : 'set') : ''}" data-day="${d.day}" data-slot="${s.slot}">
          <small>${PLAN_NAME[s.slot]}</small>${it ? `<b>${esc(it.activity)}</b>` : '<span>+ pick</span>'}</button>`; }).join('')}</div>`).join('')}</div>
      <p class="kj-day" style="margin-top:14px">Your ideas</p><div id="kjIdeas">${p.ideas.map((i) => `<span class="kj-pill on">${esc(i.text)}</span>`).join(' ') || '<span class="muted small">No ideas yet — add some in the picker.</span>'}</div>
      <p class="muted small">Tap a slot to choose something. Tick it off when you’ve done it.</p>`;
    body.querySelectorAll('.kj-slot').forEach((b) => { b.onclick = () => choose(b.dataset.day, b.dataset.slot, p, body); });
  }

  async function choose(day, slot, p, body) {
    const bank = await K().api('/plan/bank');
    const cur = p.days.find((d) => d.day === day).slots.find((s) => s.slot === slot).item;
    const used = new Set(p.days.flatMap((d) => d.slots.map((s) => s.item && s.item.category)).filter(Boolean));
    sheet(`<h1>${PLAN_NAME[slot]} · ${esc(dayLabel(day).split(',')[0])}</h1>
      ${cur ? `<div class="kj-now"><b>${esc(cur.activity)}</b><div class="small muted">${esc(cur.category)}</div>
        <div class="row" style="margin-top:8px"><button class="kj-pill ${cur.done ? 'on' : ''}" id="kjDone">${cur.done ? '✓ Done' : 'Tick when done'}</button><button class="kj-pill" id="kjClear">Clear</button></div></div>` : ''}
      <button class="btn secondary block big" id="kjSurprise" style="margin:10px 0">🎲 Surprise me</button>
      <p class="muted small">Or pick a kind of thing:</p>
      <div class="kj-cats">${bank.categories.map((c) => `<button class="kj-cat ${used.has(c.name) ? 'used' : ''}" data-cat="${esc(c.name)}">${c.icon} ${esc(c.name)}</button>`).join('')}</div>
      <div id="kjList"></div>
      <p class="muted small" style="margin-top:12px">Got an idea of your own?</p>
      <div class="row"><input id="kjIdea" placeholder="e.g. build a volcano" maxlength="120" class="grow"><button class="btn" id="kjAddIdea">Add</button></div>`, (el, close) => {
      const save = async (activity, category, source) => { await K().api('/plan', { body: { day, slot, activity, category, source } }); close(); plan(body); };
      const done = el.querySelector('#kjDone'); if (done) done.onclick = async () => { await K().api(`/plan/${cur.id}`, { method: 'PATCH', body: { done: !cur.done } }); close(); plan(body); };
      const clear = el.querySelector('#kjClear'); if (clear) clear.onclick = async () => { await K().api(`/plan/${cur.id}`, { method: 'DELETE' }); close(); plan(body); };
      el.querySelector('#kjSurprise').onclick = async () => { const r = await K().api('/plan/pick', { body: { day, slot } }); close(); toast(`How about: ${r.activity}`); plan(body); };
      el.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => {
        const cat = bank.categories.find((c) => c.name === b.dataset.cat);
        const mine = bank.ideas.filter((i) => i.category === cat.name);
        el.querySelector('#kjList').innerHTML = `<div class="kj-list">${[...cat.items.map((t) => ({ t, src: 'bank' })), ...mine.map((i) => ({ t: i.text, src: 'idea' }))].map((x) =>
          `<button class="kj-item" data-pick="${esc(x.t)}" data-src="${x.src}">${esc(x.t)}</button>`).join('')}</div>`;
        el.querySelectorAll('[data-pick]').forEach((x) => { x.onclick = () => save(x.dataset.pick, cat.name, x.dataset.src); });
      }; });
      el.querySelector('#kjAddIdea').onclick = async () => {
        const text = el.querySelector('#kjIdea').value.trim(); if (!text) return;
        await K().api('/plan/ideas', { body: { text, category: 'Other' } }); save(text, 'Other', 'idea');
      };
    });
  }

  // ---------------------------------------------------------------- guide
  async function guide(body) {
    const g = await K().api('/jobs/guide');
    body.innerHTML = `<div class="kj-guide">${g.child.map((x) => `<h2>${esc(x.h)}</h2><p>${esc(x.p)}</p>`).join('')}</div>`;
  }

  F.kids.register({ id: 'responsibilities', emoji: '✅', name: 'My responsibilities', short: 'Jobs list', colour: '#6f9f5c', order: 15, render });
  F.kjobs = { today, plan, render };
})();
