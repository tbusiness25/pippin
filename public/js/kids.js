/*
 * Kids' experience: a child account gets this home and tab bar instead of the adult app.
 * Modules (chores, books, stories…) register themselves with F.kids.register({...}) from their own files:
 *   F.kids.register({ id: 'books', emoji: '📚', name: 'Books', colour: '#4a9abf', order: 20,
 *                     tab: true,                       // optional: show in the bottom bar
 *                     render: async (el, rest) => {} }) // draws into el; rest = path after #k/books/
 * Route: #k → kids home, #k/<id>/<rest> → that module. Use F.kids.api() for /api/kids calls — when a parent
 * is looking at a child's screen it adds ?child=… automatically.
 * Parent panels for the Family section register with F.family.childPanel({...}) (see family.js).
 */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const $tabs = document.getElementById('tabs');
  const mods = {};
  let me = null;               // /api/kids/me
  let adultTabs = null;

  function withChild(path) {
    const c = F.kids.viewingChild;
    if (!c) return path;
    return path + (path.includes('?') ? '&' : '?') + `child=${encodeURIComponent(c)}`;
  }
  const kapi = (path, opts) => api(withChild(path.startsWith('/api/') ? path : `/api/kids${path}`), opts);

  /** Rewards come back from kid endpoints as { sprig: { messages, energy } } — show them joyfully. */
  function celebrate(r) {
    const s = r && (r.sprig || r);
    if (!s || !s.messages || !s.messages.length) return;
    F.showMessages(s.messages);
    if (s.energy?.started) setTimeout(() => sheet(`<div class="center"><div style="font-size:3.4rem">🎒</div><h1>Off on an adventure!</h1>
      <p>Your sprig is going to <b>${esc(s.energy.started.place)}</b>. They'll come back with a story for you.</p><button class="btn block big" id="ok">Have fun!</button></div>`,
      (sh, close) => sh.querySelector('#ok').onclick = close), 1600);
  }

  function setKidTabs(active) {
    if (!adultTabs) adultTabs = $tabs.innerHTML;
    const enabled = new Set((me && me.modules) || []);
    const tabs = [['', '🌱', 'Home']].concat(Object.values(mods).filter((m) => m.tab && enabled.has(m.id)).sort((a, b) => (a.order || 50) - (b.order || 50)).slice(0, 4).map((m) => [m.id, m.emoji, m.short || m.name]));
    $tabs.innerHTML = tabs.map(([id, em, n]) => `<a href="#k${id ? `/${id}` : ''}" data-tab="k-${id || 'home'}"><span class="ic">${em}</span>${esc(n)}</a>`).join('');
    $tabs.classList.remove('hidden');
    $tabs.classList.add('kid-tabs');
    $tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === `k-${active || 'home'}`));
  }
  function restoreAdultTabs() { if (adultTabs != null) { $tabs.innerHTML = adultTabs; $tabs.classList.remove('kid-tabs'); adultTabs = null; } }

  const money = (p) => (p >= 100 ? `£${(p / 100).toFixed(p % 100 ? 2 : 0)}` : `${p}p`);
  function jarSvg(j) {
    const pct = j.target_pence ? Math.max(0, Math.min(1, j.saved_pence / j.target_pence)) : Math.min(1, j.saved_pence / 2000);
    const h = Math.round(46 * pct);
    return `<svg viewBox="0 0 44 60" width="44" height="60" aria-hidden="true"><rect x="12" y="2" width="20" height="6" rx="2" fill="#c9a26b"/>
      <path d="M8 10 Q4 12 4 20 L4 52 Q4 58 12 58 L32 58 Q40 58 40 52 L40 20 Q40 12 36 10 Z" fill="#e8f4fb" stroke="#9cc3d8" stroke-width="2"/>
      <rect x="6" y="${56 - h}" width="32" height="${h}" rx="4" fill="#f2c14e"/>${pct >= 1 ? '<text x="14" y="36" font-size="16">⭐</text>' : ''}</svg>`;
  }

  async function home() {
    me = await kapi('/me');
    setKidTabs('');
    if (me.access && me.access.limited && !me.asParent) {
      const until = me.access.until ? `until ${esc(me.access.until)}` : 'for now';
      if (!me.modules.length) {
        $app.innerHTML = `<div class="kids"><div class="card kid-card center" style="margin-top:12vh"><div style="font-size:3.4rem">🌙</div>
          <h1>Tablet time is finished</h1><p>The app is resting ${until}. See you then!</p>
          <p class="small muted">Anything you need to finish can wait until tomorrow.</p></div></div>`;
        return;
      }
      $app.insertAdjacentHTML('afterbegin', `<div class="card kid-card center" style="margin:10px 0">⏳ Just the ${me.modules.map((m) => esc((F.kids.modules[m] || {}).name || m)).join(' and ')} for now — everything else is back ${until}.</div>`);
    }
    const s = F.state, p = s.pet;
    const pct = p ? Math.round((p.energy / p.energyCap) * 100) : 0;
    const away = p?.adventure?.status === 'away', back = p?.adventure?.status === 'home';
    const tiles = Object.values(mods).filter((m) => me.modules.includes(m.id)).sort((a, b) => (a.order || 50) - (b.order || 50));
    const hr = new Date().getHours();
    const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Hello' : 'Good evening';
    $app.innerHTML = `<div class="kids">
      <div class="kid-hello"><h1>${hello}, ${esc(me.child.name)}! 👋</h1><a class="kid-acorns" href="#shop">🌰 ${p?.acorns ?? 0}</a></div>
      ${away ? `<div class="card kid-card center"><div style="font-size:3rem">🎒</div><h2>${esc(p.name)} is exploring ${esc(p.adventure.place)}</h2>
          <p class="muted">Every job you do brings ${esc(p.name)} home sooner!</p></div>`
        : `<div class="kid-room" id="room">${Room.room(p.home, sprigOf(p, { mood: back ? 'excited' : 'happy', size: 150 }), p.equipped?.companion ? Sprig.companion(p.equipped.companion, 44) : '')}
          ${me.jars.length ? `<div class="kid-jars" title="Your savings pots">${me.jars.map((j) => `<a class="kid-jar" href="#k/money">${jarSvg(j)}<span>${esc(j.icon_emoji || '🐷')} ${money(j.saved_pence)}</span></a>`).join('')}</div>` : ''}</div>`}
      ${back ? `<button class="btn warm block big" id="welcome">🎉 ${esc(p.name)} is home! Tap to hear the story</button>` : ''}
      ${!away ? `<div class="card kid-card"><div class="row"><b class="grow">${esc(p.name)}’s energy</b><span>${p.energy}/${p.energyCap}</span></div>
        <div class="energy big" style="margin-top:8px"><div style="width:${pct}%"></div></div>
        <p class="small muted" style="margin:.4em 0 0">Jobs, books and stories fill it up. Full bar = adventure time!</p></div>` : ''}
      <div class="kid-grid">${tiles.map((m) => `<a class="kid-tile" href="#k/${m.id}" style="--c:${m.colour || '#6f9f5c'}"><span class="em">${m.emoji}</span><b>${esc(m.name)}</b>${m.badge ? `<span class="kid-badge" data-badge="${m.id}"></span>` : ''}</a>`).join('')}
        ${me.access && me.access.limited ? '' : '<a class="kid-tile" href="#shop" style="--c:#c9774d"><span class="em">🛍️</span><b>Sprig shop</b></a>'}</div>
      ${me.asParent ? '<p class="small muted center">You’re viewing this as a parent.</p>' : '<p class="center"><button class="btn ghost small" id="wnOpen">✨ What’s new?</button></p>'}</div>`;
    document.getElementById('room')?.addEventListener('click', () => { location.hash = '#shop/home'; });
    document.getElementById('welcome')?.addEventListener('click', welcomeHome);
    document.getElementById('wnOpen')?.addEventListener('click', () => F.kids.whatsNew?.show(me, p));
    if (!back) F.kids.whatsNew?.maybeShow(me, p);
    for (const m of tiles) if (m.badge) m.badge().then((n) => { const el = $app.querySelector(`[data-badge="${m.id}"]`); if (el && n) el.textContent = n; }).catch(() => {});
  }

  async function welcomeHome() {
    const b = document.getElementById('welcome'); b.disabled = true; b.textContent = 'Listening…';
    try {
      const r = await api('/api/pet/adventure/return', { body: {} });
      const p = F.state.pet;
      F.showMessages(r.messages);
      sheet(`<div class="center">${sprigOf(p, { mood: 'excited', size: 130 })}</div><h1>${esc(r.story.title)}</h1><p class="kid-story">${esc(r.story.story)}</p>
        <div class="card" style="background:var(--bg)"><b>Found:</b> ${esc(r.story.discovery)}</div>
        ${r.grew ? `<div class="card" style="background:var(--bg)">🌱 <b>${esc(p.name)} grew into a ${esc(r.grew)}!</b></div>` : ''}
        <p class="center big">+${r.acorns} 🌰</p><button class="btn block big" id="ok">Thank you, ${esc(p.name)}!</button>`,
      (sh, close) => sh.querySelector('#ok').onclick = () => { close(); F.go('#k'); F.refresh().then(home); });
    } catch (e) { toast(e.message); b.disabled = false; }
  }

  async function route(rest) {
    const [id, ...more] = (rest || '').split('/');
    if (!me) me = await kapi('/me').catch(() => ({ modules: [], jars: [] }));
    if (!id) return home();
    const m = mods[id];
    if (!m || !me.modules.includes(id)) return home();
    setKidTabs(id);
    $app.innerHTML = '<div class="kids"><p class="muted center" style="margin-top:30vh">Loading…</p></div>';
    try { await m.render($app, more.join('/')); }
    catch (e) { if (e.message !== 'signed out') $app.innerHTML = `<div class="kids"><div class="card kid-card">Oops — ${esc(e.message)} <button class="btn ghost" onclick="location.reload()">Try again</button></div></div>`; }
  }

  // Back button + title for module screens.
  const header = (title, emoji, backTo = '#k') => `<div class="kid-head"><a class="kid-back" href="${backTo}" aria-label="Back">‹</a><h1>${emoji ? `${emoji} ` : ''}${esc(title)}</h1></div>`;

  F.kids = {
    register(m) { mods[m.id] = m; },
    modules: mods, api: kapi, celebrate, header, money, restoreAdultTabs, setKidTabs,
    viewingChild: null,
    get me() { return me; },
    refreshMe: async () => (me = await kapi('/me')),
  };
  F.routes.k = route;
})();
