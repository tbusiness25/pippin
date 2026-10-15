/*
 * Family → a child's jobs & rules: edit their daily jobs, set the time-of-day rules for their app, read the growing-up
 * guide, and see their week's plan. Family → a child's Yoto: the connection and their cards. (src/kids/jobs.js, yoto.js)
 */
(function () {
  const { esc, toast, sheet } = F.family ? F : F;
  const kapi = (c, p, o) => F.family.kapi(c, p, o);
  const SLOTS = [['morning', '🌅 Morning'], ['after_school', '🏫 After school'], ['bedtime', '🌙 Bedtime'], ['weekly', '🧹 Weekends']];
  const DAYS = [['daily', 'Every day'], ['school', 'School days'], ['weekend', 'Weekends']];
  const APPS = [['yoto', '🎧 My Yoto'], ['books', '📚 Books (reading)'], ['responsibilities', '✅ My responsibilities'], ['stories', '🌙 Stories'], ['games', '🎮 Games'],
    ['library', '🎵 Library'], ['today', '📰 Today'], ['learn', '🧠 Learn'], ['hopenotes', '💬 Messages'], ['typing', '⌨️ Typing'], ['chores', '🧹 Chores'], ['buddy', '🤖 Buddy'], ['room', '🛋 Room'], ['stars', '⭐ Stars']];

  F.family.childPanel({ id: 'responsibilities', emoji: '✅', name: 'Responsibilities & rules', order: 30, render: jobsPanel });
  F.family.childPanel({ id: 'yoto', emoji: '🎧', name: 'Yoto', order: 31, render: yotoPanel });

  // ---------------------------------------------------------------- jobs & rules
  async function jobsPanel(el, child) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const [jobs, access, guide] = await Promise.all([kapi(child, '/jobs/all'), kapi(child, '/access'), kapi(child, '/jobs/guide')]);
    let rules = access.rules.length ? access.rules : [{ from: '19:00', to: '19:30', allow: ['yoto', 'books'] }];
    const draw = () => {
      el.innerHTML = `
        <div class="card"><h2 style="margin-top:0">Daily jobs</h2>
          <p class="small muted">These show up on ${esc(child.name)}’s “My jobs” each day. Keep them few, clear and the same, and change one at a time.</p>
          ${SLOTS.map(([s, label]) => { const list = jobs.jobs.filter((j) => j.slot === s); return `<div class="fam-h">${label}</div>${list.map((j) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line);${j.active ? '' : 'opacity:.5'}">
            <div class="grow"><b>${esc(j.icon)} ${esc(j.title)}</b><div class="small muted">${esc(DAYS.find((d) => d[0] === j.days)[1])}${j.timer_secs ? ` · ⏱ ${Math.round(j.timer_secs / 60)} min` : ''}${j.active ? '' : ' · hidden'}</div></div>
            <button class="btn ghost" data-edit="${j.id}">Edit</button></div>`).join('') || '<p class="small muted">None yet.</p>'}`; }).join('')}
          <button class="btn secondary block" id="jAdd" style="margin-top:10px">+ Add a job</button></div>

        <div class="card"><h2 style="margin-top:0">Time of day</h2>
          <p class="small muted">When the app is restricted, only the apps ticked here work. Outside these windows everything works. Times are London time. Morning isn’t restricted unless you add a rule for it.</p>
          ${rules.map((r, i) => `<div class="card" style="background:var(--bg);margin:8px 0"><div class="row wrap"><input type="time" value="${r.from}" data-from="${i}"> to <input type="time" value="${r.to}" data-to="${i}">
            <button class="btn ghost" data-rm="${i}" style="margin-left:auto">Remove</button></div>
            <div class="row wrap" style="margin-top:6px">${APPS.map(([k, l]) => `<label class="pill" style="margin:0"><input type="checkbox" data-allow="${i}" value="${k}" ${r.allow.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>`).join('')}
          <div class="row wrap"><button class="btn secondary" id="rAdd">+ Add a window</button><button class="btn" id="rSave">Save times</button></div></div>

        <div class="card"><h2 style="margin-top:0">Growing up: the grown-up version</h2>${guide.parents.map((p) => `<p class="small">• ${esc(p)}</p>`).join('')}</div>`;
      el.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => jobSheet(jobs.jobs.find((j) => j.id === b.dataset.edit)); });
      el.querySelector('#jAdd').onclick = () => jobSheet(null);
      el.querySelector('#rAdd').onclick = () => { collect(); rules.push({ from: '19:30', to: '07:00', allow: [] }); draw(); };
      el.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { collect(); rules.splice(+b.dataset.rm, 1); draw(); }; });
      el.querySelector('#rSave').onclick = saveRules;
    };
    function collect() {
      rules = rules.map((r, i) => ({ from: el.querySelector(`[data-from="${i}"]`).value, to: el.querySelector(`[data-to="${i}"]`).value,
        allow: [...el.querySelectorAll(`[data-allow="${i}"]:checked`)].map((x) => x.value) }));
    }
    async function saveRules() {
      collect();
      try { await kapi(child, '/access', { method: 'PUT', body: { rules } }); toast('Times saved — applies straight away'); }
      catch (e) { toast(e.message); }
    }
    function jobSheet(j) {
      const isNew = !j;
      sheet(`<h1>${isNew ? 'New job' : esc(j.title)}</h1>
        <div class="inline"><label class="fld"><span>Icon</span><input id="jIcon" value="${esc(j ? j.icon : '✅')}" maxlength="4" style="width:70px"></label>
          <label class="fld grow"><span>Name</span><input id="jTitle" value="${esc(j ? j.title : '')}" maxlength="120"></label></div>
        <label class="fld"><span>How (a sentence a 7-year-old can follow)</span><input id="jDetail" value="${esc(j ? j.detail || '' : '')}" maxlength="300"></label>
        <div class="inline"><label class="fld"><span>When in the day</span><select id="jSlot">${SLOTS.map(([s, l]) => `<option value="${s}" ${j && j.slot === s ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="fld"><span>Which days</span><select id="jDays">${DAYS.map(([s, l]) => `<option value="${s}" ${j && j.days === s ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <label class="fld"><span>Timer (minutes, optional)</span><input id="jTimer" type="number" min="0" max="60" value="${j && j.timer_secs ? Math.round(j.timer_secs / 60) : ''}"></label>
        ${isNew ? '' : `<label class="row"><input type="checkbox" id="jActive" ${j.active ? 'checked' : ''} style="width:22px;height:22px"> Show this job</label>`}
        <div class="row wrap" style="margin-top:10px"><button class="btn" id="jSave">Save</button>${isNew ? '' : '<button class="btn ghost" id="jDel">Remove</button>'}</div>`, (s2, close) => {
        s2.querySelector('#jSave').onclick = async () => {
          const body = { icon: s2.querySelector('#jIcon').value, title: s2.querySelector('#jTitle').value, detail: s2.querySelector('#jDetail').value,
            slot: s2.querySelector('#jSlot').value, days: s2.querySelector('#jDays').value, timer_secs: s2.querySelector('#jTimer').value ? +s2.querySelector('#jTimer').value * 60 : null };
          if (!isNew) body.active = s2.querySelector('#jActive').checked;
          try { await kapi(child, isNew ? '/jobs' : `/jobs/${j.id}`, { method: isNew ? 'POST' : 'PATCH', body }); close(); jobsPanel(el, child); }
          catch (e) { toast(e.message); }
        };
        const del = s2.querySelector('#jDel');
        if (del) del.onclick = async () => { await kapi(child, `/jobs/${j.id}`, { method: 'DELETE' }); close(); jobsPanel(el, child); };
      });
    }
    draw();
  }

  // ---------------------------------------------------------------- Yoto
  async function yotoPanel(el, child) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const st = await F.api('/api/family/yoto/status').catch(() => ({}));
    let cards = [];
    if (st.linked) { cards = (await kapi(child, '/yoto/cards').catch(() => ({ cards: [] }))).cards; }
    el.innerHTML = `<div class="card"><h2 style="margin-top:0">Yoto connection</h2>
        ${st.linked ? `<p>✓ Connected${st.since ? ` since ${new Date(st.since).toLocaleDateString('en-GB')}` : ''}. Yoto’s sign-in lasts a long time, so you shouldn’t need to do this again.</p>
          <button class="btn ghost" id="yDis">Disconnect</button>`
        : st.configured ? `<p>Connect the household Yoto account so ${esc(child.name)} can manage his library and cards from his app.</p>
          <a class="btn" href="/api/family/yoto/connect">Connect Yoto</a>`
        : '<p class="small muted">Yoto isn’t set up on this server yet (YOTO_REDIRECT is missing).</p>'}</div>
      ${st.linked ? `<div class="card"><h2 style="margin-top:0">${esc(child.name)}’s cards</h2>
        ${cards.map((c) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(c.title)}</b><div class="small muted">${c.tracks ? `${c.tracks} chapters` : ''}</div></div>
          <button class="btn ghost" data-del="${esc(c.id)}" data-t="${esc(c.title)}">Delete</button></div>`).join('') || '<p class="small muted">No cards yet.</p>'}
        <p class="small muted">Deleting a card removes it from Yoto for good — only grown-ups can do this.</p></div>` : ''}`;
    el.querySelector('#yDis')?.addEventListener('click', async () => { if (!confirm('Disconnect the Yoto account from Pippin?')) return; await F.api('/api/family/yoto/disconnect', { body: {} }); yotoPanel(el, child); });
    el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => {
      if (!confirm(`Delete “${b.dataset.t}” from Yoto? This can’t be undone.`)) return;
      try { await kapi(child, `/yoto/cards/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }); yotoPanel(el, child); } catch (e) { toast(e.message); }
    }; });
  }
})();
