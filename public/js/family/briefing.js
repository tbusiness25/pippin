/*
 * Explore → ☀️ Briefing: this morning's briefing (made ~07:00 for people who have it switched on), plus recent ones.
 * Shown only when the server switched it on for this person (users.settings.fam_briefing, from BRIEFING_FOR).
 */
(function () {
  const { api, esc, toast } = F;
  const $app = document.getElementById('app');
  const A = '/api/family/briefing';

  // Small, safe Markdown: escape first, then headings / bullets / bold / italics.
  function md(text) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    let html = '', list = false;
    for (const raw of String(text || '').split('\n')) {
      const l = raw.trim();
      const close = () => { if (list) { html += '</ul>'; list = false; } };
      if (/^#{1,6}\s/.test(l)) { close(); html += `<h3>${inline(l.replace(/^#{1,6}\s+/, ''))}</h3>`; }
      else if (/^[-*•]\s/.test(l)) { if (!list) { html += '<ul class="reads-list">'; list = true; } html += `<li>${inline(l.replace(/^[-*•]\s+/, ''))}</li>`; }
      else if (!l) close();
      else { close(); html += `<p>${inline(l)}</p>`; }
    }
    return html + (list ? '</ul>' : '');
  }
  const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  async function page(rest) {
    F.setTab('explore');
    $app.innerHTML = '<a href="#explore" class="btn ghost" style="padding-left:0">‹ Explore</a><h1>☀️ Briefing</h1><p class="muted">Loading…</p>';
    let t, recent;
    try { [t, recent] = await Promise.all([api(`${A}/today`), api(`${A}/recent`)]); }
    catch (e) { $app.querySelector('p').textContent = e.message; return; }
    const b = t.briefing, isToday = b && b.brief_date === t.today;
    const older = recent.briefings.filter((x) => !b || x.brief_date !== b.brief_date);
    if (rest && rest !== 'past') {
      const one = recent.briefings.find((x) => x.brief_date === rest);
      if (one) { $app.innerHTML = `<a href="#briefing" class="btn ghost" style="padding-left:0">‹ Briefing</a><h1>${esc(day(one.brief_date))}</h1><article class="card reads-body brief-body">${md(one.content)}</article>`; return; }
    }
    $app.innerHTML = `<a href="#explore" class="btn ghost" style="padding-left:0">‹ Explore</a><h1>☀️ Briefing</h1>
      ${b ? `<article class="card reads-body brief-body"><div class="small muted">${esc(day(b.brief_date))}${isToday ? '' : ' · today’s isn’t ready yet'}</div>${md(b.content)}</article>`
    : `<div class="card"><p>No briefing yet — the first one arrives around ${String(t.hour).padStart(2, '0')}:00.</p></div>`}
      <div class="row wrap"><button class="btn secondary" id="brNow">${isToday ? '↻ Write today’s again' : '☀️ Write today’s now'}</button>
        <label class="row small grow" style="justify-content:flex-end"><input type="checkbox" id="brPush" ${t.push ? 'checked' : ''} style="width:22px;height:22px"><span>Send it as a notification</span></label></div>
      <p class="small muted">Notifications only arrive if you’ve turned nudges on in Settings.</p>
      ${older.length ? `<h2>Earlier</h2>${older.map((x) => `<a class="card row" href="#briefing/${esc(x.brief_date)}" style="text-decoration:none;color:inherit">
        <div class="grow"><b>${esc(day(x.brief_date))}</b><div class="small muted brief-peek">${esc(x.content.replace(/[#*]/g, '').slice(0, 120))}…</div></div><span>›</span></a>`).join('')}` : ''}`;
    $app.querySelector('#brNow').onclick = async (ev) => {
      const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Writing… (up to a minute or two)';
      try { await api(`${A}/generate`, { body: {} }); page(); } catch (e) { toast(e.message); btn.disabled = false; btn.textContent = 'Try again'; }
    };
    $app.querySelector('#brPush').onchange = async (ev) => {
      try { await api(`${A}/settings`, { body: { push: ev.target.checked } }); toast('Saved'); } catch (e) { toast(e.message); }
    };
  }

  F.routes.briefing = page;
  F.explore.tile({ href: '#briefing', emoji: '☀️', name: 'Briefing', sub: 'Your morning in a minute',
    show: (s) => s.user && s.user.role === 'adult' && !!(s.user.settings || {}).fam_briefing });
})();
