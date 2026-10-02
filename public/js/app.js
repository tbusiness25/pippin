/* Front end. Vanilla JS, hash routes, one small helper set. */
window.APP = window.APP || (window.__BUILD__ && window.__BUILD__.appName) || "App";
(function () {
  const $app = document.getElementById('app');
  const $tabs = document.getElementById('tabs');
  let state = null;          // last /api/pet/state
  let F_lock = null;
  let pollTimer = null;

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ---------- network: cache GETs for offline, queue safe writes, dedupe replays ----------
  const CACHEABLE = /^\/api\/(auth\/status|pet\/state|habits$|sober(\/content)?$|sober\/[^/]+\/calendar|goals$|tools\/content|plans\/inbox|people$)/;
  const QUEUEABLE = /^\/api\/(habits\/[^/]+\/log|sober\/[^/]+\/(day|pledge|urge|lapse)|goals\/[^/]+\/(complete|uncomplete)|plans\/inbox$|checkins$)/;
  const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  const newOpId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let offline = false;
  function markOffline(on) {
    if (on === offline) return;
    offline = on;
    let b = document.getElementById('offline');
    if (on && !b) { b = document.createElement('div'); b.id = 'offline'; b.className = 'update-banner'; b.style.background = '#7a746a'; document.body.appendChild(b); }
    if (b) { if (on) b.textContent = `Offline — your taps are saved and will sync${(store.get('finch-outbox') || []).length ? ` (${(store.get('finch-outbox') || []).length} waiting)` : ''}`; else b.remove(); }
  }
  async function flushOutbox() {
    const box = store.get('finch-outbox') || [];
    if (!box.length) return;
    const left = [];
    for (const op of box) {
      try {
        const r = await fetch(op.path, { method: op.method, headers: { 'Content-Type': 'application/json', 'X-Op-Id': op.opId }, body: JSON.stringify(op.body || {}), credentials: 'same-origin' });
        if (r.status >= 500) left.push(op);          // server trouble: keep; 4xx: drop (won't ever succeed)
      } catch (_) { left.push(op); }
    }
    store.set('finch-outbox', left);
    if (!left.length && box.length) { markOffline(false); toast(`Synced ${box.length} saved update${box.length === 1 ? '' : 's'} ✓`); }
  }
  window.addEventListener('online', () => flushOutbox().then(route));
  setInterval(() => { if ((store.get('finch-outbox') || []).length) flushOutbox(); }, 30000);

  async function api(path, opts = {}) {
    const method = opts.method || (opts.body ? 'POST' : 'GET');
    const opId = method === 'GET' ? null : newOpId();
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opId ? { 'X-Op-Id': opId } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin',
      });
    } catch (netErr) {
      if (method === 'GET' && CACHEABLE.test(path)) { const c = store.get(`finch-cache:${path}`); if (c) { markOffline(true); return c; } }
      if (method !== 'GET' && QUEUEABLE.test(path)) {
        const box = store.get('finch-outbox') || [];
        box.push({ path, method, body: opts.body || {}, opId, at: Date.now() });
        store.set('finch-outbox', box);
        offline = false; markOffline(true);
        return { ok: true, queued: true, messages: [] };
      }
      markOffline(true);
      throw new Error('You’re offline — this needs a connection');
    }
    markOffline(false);
    if (res.status === 401 && !path.startsWith('/api/auth')) { location.hash = '#login'; throw new Error('signed out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
    if (method === 'GET' && CACHEABLE.test(path)) store.set(`finch-cache:${path}`, data);
    return data;
  }

  // ---------- app lock (PIN after inactivity; works offline via a local PBKDF2 hash) ----------
  const LOCK_KEY = 'finch-lock-mins';
  const lockMins = () => { const v = store.get(LOCK_KEY); return v === null ? 5 : v; };   // default: 5 minutes
  const touch = () => store.set('finch-last-active', Date.now());
  ['click', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, () => { if (!document.getElementById('lock')) touch(); }, { passive: true }));
  async function pinHash(pin, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function rememberPin(pin) {
    if (!crypto.subtle) return;
    const salt = newOpId();
    store.set('finch-pin', { salt, hash: await pinHash(pin, salt) });
  }
  function shouldLock() {
    const m = lockMins();
    if (m === 'off' || !store.get('finch-pin')) return false;
    return Date.now() - (store.get('finch-last-active') || 0) > m * 60000;
  }
  function showLock() {
    if (document.getElementById('lock')) return;
    let pin = '';
    const el = document.createElement('div');
    el.id = 'lock';
    el.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:50;overflow:auto;padding:24px 16px';
    el.innerHTML = `<div style="max-width:360px;margin:6vh auto 0;text-align:center"><div style="font-size:2.4rem">🔒</div><h1>${esc(APP)} is locked</h1>
      <div class="pin-dots" id="ld"></div><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => `<button ${k === '' ? 'disabled style="visibility:hidden"' : ''} data-k="${k}">${k}</button>`).join('')}</div></div>`;
    document.body.appendChild(el);
    const dots = () => { el.querySelector('#ld').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? 'on' : ''}"></span>`).join(''); };
    dots();
    let t = null;
    const check = async () => {
      const saved = store.get('finch-pin');
      let okLocal = false;
      try { okLocal = !!saved && (await pinHash(pin, saved.salt)) === saved.hash; } catch (_) {}
      let ok = okLocal;
      if (!ok && navigator.onLine) {
        try { const r = await fetch('/api/auth/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }), credentials: 'same-origin' }); ok = r.ok; if (ok) rememberPin(pin); } catch (_) {}
      }
      if (ok) { el.remove(); touch(); } else { toast('That PIN didn’t match'); pin = ''; dots(); }
    };
    el.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 8) pin += k;
      dots(); clearTimeout(t);
      if (pin.length >= 4) t = setTimeout(check, 600);
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && shouldLock()) showLock(); else if (document.visibilityState === 'hidden') touch(); });
  F_lock = { showLock, lockMins, setLockMins: (m) => store.set(LOCK_KEY, m), rememberPin, hasPin: () => !!store.get('finch-pin') };

  function toast(msg, ms = 2600) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
  function sheet(html, onMount) {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    if (onMount) onMount(bg.querySelector('.sheet'), close);
    return close;
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const hour = () => new Date().getHours();
  function timeLeft(iso) {
    const ms = new Date(iso) - Date.now();
    if (ms <= 0) return 'any moment';
    const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000);
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
  const ENERGIES = ['🪫', '😮‍💨', '🙂', '💪', '⚡'];
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const CAT_EMOJI = { body: '💧', mind: '🧠', home: '🏡', people: '💛', work: '💼', money: '💷', admin: '📋', fun: '🎨', rest: '😴', general: '🌿' };
  const sprigOf = (p, opts = {}) => Sprig.sprig({ colour: p.colour, stage: p.stage?.key || p.stage, equipped: p.equipped, ...opts });
  window.sprigOf = sprigOf;

  // Shared with the feature modules (explore.js, shop.js, friends.js).
  const F = window.F = {
    api, esc, toast, sheet, pick, setTab: (n) => setTab(n), routes: {},
    get state() { return state; },
    refresh: async () => (state = await api('/api/pet/state')),
    afterEnergy: (...a) => afterEnergy(...a), showMessages: (m) => showMessages(m),
    CAT_EMOJI: null, go: (h) => { location.hash = h; },
    lock: () => F_lock,
  };
  function showMessages(msgs) {
    (msgs || []).forEach((m, i) => setTimeout(() => toast(m, 3200), i * 1400));
  }
  function setTab(name) {
    $tabs.classList.toggle('hidden', !name);
    $tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
  }

  // ---------- router ----------
  async function route() {
    clearInterval(pollTimer);
    const r = (location.hash || '#home').slice(1);
    try {
      const st = await api('/api/auth/status');
      if (st.setup) return renderSetup(st.setupCode);
      if (!st.signedIn) return renderLogin(st.people);
      if (r === 'login') { location.hash = '#home'; return; }
      state = await api('/api/pet/state');
      if (!state.pet) return renderHatch();
      F.CAT_EMOJI = CAT_EMOJI;
      const [key, ...rest] = r.split('/');
      const builtIn = { home: renderHome, coach: renderCoach, goals: renderGoals, journal: renderJournal, me: renderMe };
      (F.routes[key] || builtIn[key] || renderHome)(rest.join('/'));
    } catch (e) {
      if (e.message !== 'signed out') console.error('[route]', e.stack || e);
      if (e.message !== 'signed out') $app.innerHTML = `<div class="card">Couldn’t load: ${esc(e.message)} <button class="btn ghost" onclick="location.reload()">Retry</button></div>`;
    }
  }
  window.addEventListener('hashchange', route);

  // ---------- setup & login ----------
  function renderSetup(needCode) {
    setTab(null);
    $app.innerHTML = `
      <div class="stage">${Sprig.egg('moss', 120)}</div>
      <div class="card"><h1>Welcome to ${APP}</h1>
        <p class="muted">A little moss creature that thrives when you look after yourself. First, a name and a PIN for this device.</p>
        <div class="field"><label for="nm">What should I call you?</label><input id="nm" autocomplete="given-name" maxlength="40"></div>
        <div class="field"><label for="pn">Choose a PIN (4–8 digits)</label><input id="pn" inputmode="numeric" type="password" maxlength="8"></div>
        ${needCode ? '<div class="field"><label for="sc">Setup code (from the server’s .env)</label><input id="sc" autocomplete="off"></div>' : ''}
        <button class="btn block" id="go">Start</button></div>`;
    document.getElementById('go').onclick = async () => {
      try { await api('/api/auth/setup', { body: { name: nm.value, pin: pn.value, setup_code: document.getElementById('sc')?.value } }); F_lock.rememberPin(pn.value); touch(); location.hash = '#home'; route(); }
      catch (e) { toast(e.message); }
    };
  }

  function renderLogin(people = []) {
    setTab(null);
    let pin = '';
    let who = null;
    if (people.length && !renderLogin.chosen) {
      $app.innerHTML = `<div class="stage">${Sprig.sprig({ colour: 'moss', stage: 'sprout', mood: 'happy', size: 140 })}</div>
        <h1 class="center">Who’s this?</h1><div class="grid">${people.map((p) => `<button class="tile" data-u="${p.id}"><span class="em">🌱</span><b>${esc(p.name)}</b></button>`).join('')}</div>`;
      $app.querySelectorAll('[data-u]').forEach((b) => b.onclick = () => { renderLogin.chosen = b.dataset.u; renderLogin(people); });
      return;
    }
    who = renderLogin.chosen || null;
    $app.innerHTML = `<div class="stage">${Sprig.sprig({ colour: 'moss', stage: 'sprout', mood: 'calm', size: 150 })}</div>
      <h1 class="center">Welcome back</h1><div class="pin-dots" id="dots"></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => `<button ${k === '' ? 'disabled style="visibility:hidden"' : ''} data-k="${k}">${k}</button>`).join('')}</div>`;
    const dots = () => { document.getElementById('dots').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? 'on' : ''}"></span>`).join(''); };
    dots();
    const submit = async () => {
      try { await api('/api/auth/login', { body: { pin, user_id: who } }); F_lock.rememberPin(pin); touch(); renderLogin.chosen = null; location.hash = '#home'; route(); }
      catch (e) { toast(e.message); pin = ''; dots(); }
    };
    $app.querySelectorAll('.pad button').forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 8) pin += k;
      dots();
      if (pin.length >= 4) { clearTimeout(b._t); window._pinT && clearTimeout(window._pinT); window._pinT = setTimeout(submit, 700); }
    });
  }

  // ---------- hatch (onboarding) ----------
  function renderHatch() {
    setTab(null);
    const o = state.options;
    let colour = 'moss', trait = 'curious', pronouns = 'they/them';
    const draw = () => {
      $app.innerHTML = `
        <div class="card center"><h1>An egg is waiting for you</h1>
          <p class="muted">Pick a colour. Whatever hatches will be yours to look after — and it will look after you back.</p>
          <div class="stage" id="egg">${Sprig.egg(colour, 120)}</div>
          <div class="colours">${o.colours.map((c) => `<button class="${c === colour ? 'on' : ''}" data-c="${c}" aria-label="${c}">${Sprig.egg(c, 34)}</button>`).join('')}</div></div>
        <div class="card">
          <div class="field"><label for="pname">Name</label><input id="pname" maxlength="24" placeholder="e.g. Pip"></div>
          <div class="field"><label>Pronouns</label><div class="row wrap">${['they/them', 'she/her', 'he/him', 'it/its'].map((p) => `<button class="chip ${p === pronouns ? 'on' : ''}" data-p="${p}">${p}</button>`).join('')}</div></div>
          <div class="field"><label>One word for their personality</label><div class="row wrap">${o.traits.map((t) => `<button class="chip ${t === trait ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div></div>
          <button class="btn block" id="hatch">Hatch</button></div>`;
      $app.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { const n = pname.value; colour = b.dataset.c; draw(); pname.value = n; });
      $app.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { const n = pname.value; pronouns = b.dataset.p; draw(); pname.value = n; });
      $app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { const n = pname.value; trait = b.dataset.t; draw(); pname.value = n; });
      document.getElementById('hatch').onclick = async () => {
        const name = pname.value.trim();
        if (!name) return toast('Give them a name first');
        const egg = document.getElementById('egg');
        egg.firstElementChild.classList.add('wiggle');
        try {
          await api('/api/pet/hatch', { body: { name, colour, trait, pronouns } });
          setTimeout(() => { egg.innerHTML = Sprig.sprig({ colour, stage: 'seedling', mood: 'excited', size: 180 }); }, 600);
          setTimeout(() => sheet(`<div class="center"><h1>Hello, ${esc(name)}!</h1>
            <p>${esc(name)} is a seedling sprig. Every small thing you do for yourself gives ${esc(name)} energy. Fill the bar and they’ll go off on an adventure — and come back with a story for you.</p>
            <p class="muted small">Nothing bad ever happens if you miss a day. ${esc(name)} will just be happy to see you.</p>
            <button class="btn block" id="ok">Let’s go</button></div>`, (s, close) => s.querySelector('#ok').onclick = () => { close(); location.hash = '#home'; route(); }), 1500);
        } catch (e) { toast(e.message); }
      };
    };
    draw();
  }

  // ---------- home ----------
  function petMood(p) {
    if (p.adventure?.status === 'home') return 'excited';
    const h = hour();
    if (h >= 22 || h < 6) return 'sleepy';
    return p.energy >= p.energyCap * 0.6 ? 'excited' : 'happy';
  }
  function speech(s) {
    const p = s.pet, n = s.user.name;
    if (p.adventure?.status === 'home') return `I’m back from ${p.adventure.place}! I have things to tell you.`;
    if (p.adventure?.status === 'away') return null;
    const h = hour();
    if (!s.checkins.morning && h >= 5 && h < 14) return `Morning, ${n}! How are you feeling?`;
    if (!s.checkins.evening && h >= 18) return `How was today, ${n}? Tell me one good thing.`;
    const left = s.goals.filter((g) => !g.done).length;
    if (!s.goals.length) return 'Shall we pick one small thing to do today?';
    if (!left) return pick(['You did everything today. I’m so proud of you.', 'All done! Rest is productive too.']);
    return pick(['One small thing at a time.', 'Want to try the easiest one first?', 'I believe in you.', 'Drink some water? I’ll wait.', `${left} left — no rush.`]);
  }

  function renderHome() {
    setTab('home');
    const s = state, p = s.pet;
    const say = speech(s);
    const pct = Math.round((p.energy / p.energyCap) * 100);
    const streakChip = s.streak.enabled ? `<span class="stat" title="Days in a row">🔥 ${s.streak.days}${s.streak.paused ? ' ⏸' : ''}</span>` : '';
    const away = p.adventure?.status === 'away';
    const home = p.adventure?.status === 'home';
    const needsMorning = !s.checkins.morning && hour() < 14;
    const needsEvening = !s.checkins.evening && hour() >= 17;

    const ev = s.event;
    $app.innerHTML = `
      <div class="topbar"><a class="stat" href="#shop" style="text-decoration:none;color:inherit">🌰 ${p.acorns}</a><span class="small muted">${esc(p.stage.name)}</span>${streakChip || '<span></span>'}</div>
      ${s.lastActiveDaysAgo >= 4 ? `<a class="banner row" href="#coach/flow/welcome" style="text-decoration:none;background:linear-gradient(90deg,#dff0d8,#e8f4e1);color:#2f4d24"><span style="font-size:1.5rem">👋</span><div class="grow"><b>Welcome back</b><div class="small">No catching up needed. Want to pick one small thing for today?</div></div></a>` : ''}
      ${ev ? `<a class="banner row" href="#shop" style="text-decoration:none"><span style="font-size:1.5rem">${ev.emoji}</span><div class="grow"><b>${esc(ev.name)}</b><div class="small">Every goal earns ${esc(ev.token)} — you have ${ev.tokens}. Spend them in the shop.</div></div></a>` : ''}
      ${s.streak.enabled && s.streak.repairable ? `<div class="card small">Your ${s.streak.days ? '' : ''}streak has a little gap. <button class="btn ghost" id="mend">Mend it${s.streak.repairable.cost ? ` (🌰${s.streak.repairable.cost})` : ' (free)'}</button></div>` : ''}
      ${away ? `<div class="card away"><div class="scene">🎒</div><h2>${esc(p.name)} is off to ${esc(p.adventure.place)}</h2>
          <p class="muted">Back in about <b>${timeLeft(p.adventure.endsAt)}</b>. Each goal you finish brings them home 10 minutes sooner.</p></div>`
        : `<div class="stage">${say ? `<div class="bubble">${esc(say)}</div>` : ''}
          <div id="pet">${Room.room(p.home, sprigOf(p, { mood: petMood(p), size: 150 }), p.equipped?.companion ? Sprig.companion(p.equipped.companion, 44) : '')}</div>
          <div class="petname">${esc(p.name)}</div></div>`}
      ${home ? `<button class="btn warm block" id="welcome">Welcome ${esc(p.name)} home 🎉</button><div style="height:14px"></div>` : ''}
      ${!away ? `<div class="card"><div class="row"><b class="grow">Energy</b><span class="small muted">${p.energy}/${p.energyCap}</span></div>
          <div class="energy" style="margin-top:8px"><div style="width:${pct}%"></div></div>
          <p class="small muted" style="margin:.5em 0 0">A full bar sends ${esc(p.name)} on an adventure.</p></div>` : ''}
      ${(s.trackers || []).map((t) => { const started = t.sd <= s.today; return `<div class="card row" data-tr="${t.id}">
        <div class="grow" style="cursor:pointer" data-open="${t.id}"><div class="small muted">${t.discreet ? '🌱 Good days' : esc(t.label)}</div>
          <b style="font-size:1.5rem;font-family:var(--display)">${started ? t.free : '—'}</b> <span class="small muted">${started ? (t.discreet ? 'and counting' : 'free days') : `starts ${esc(t.sd)}`}</span></div>
        ${started && !t.today_status && hour() >= 17 ? `<button class="btn secondary" data-free="${t.id}">✓ Good day</button>` : `<span class="small muted">${t.today_status === 'free' ? '✓ today' : t.today_status === 'lapse' ? 'logged' : ''}</span>`}</div>`; }).join('')}
      ${(s.checksDue || []).length ? `<a class="card row" href="#explore/quizzes/${s.checksDue[0].quiz}" style="text-decoration:none;color:inherit"><span style="font-size:1.6rem">📋</span><div class="grow"><b>Monthly check-in</b><div class="small muted">${esc(s.checksDue[0].name)} — 2 minutes, builds your picture over time</div></div><span>›</span></a>` : ''}
      ${(s.habitsToday || []).length ? `<div class="card"><div class="row"><h2 class="grow">Habits</h2><a class="btn ghost" href="#habits">All ›</a></div>
        ${s.habitsToday.map((h) => `<div class="row" style="padding:6px 0"><span class="grow">${esc(h.title)}</span>${h.today ? `<span class="small muted">✓ ${h.today === 'skip' ? 'rest day' : h.today}</span>` : `<button class="btn secondary" data-hdone="${h.id}">Done</button>`}</div>`).join('')}</div>` : ''}
      ${needsMorning ? `<button class="btn block" id="ckm">☀️ Morning check-in</button><div style="height:14px"></div>` : ''}
      ${needsEvening ? `<button class="btn block" id="cke">🌙 Evening check-in</button><div style="height:14px"></div>` : ''}
      <div class="card"><div class="row"><h2 class="grow">Today</h2><a class="btn ghost" href="#goals">+ Add</a></div>
        <div id="goals">${s.goals.length ? s.goals.map(goalRow).join('') : `<p class="muted">Nothing yet. Pick one tiny thing — or ask your coach.</p>`}</div></div>
      <div class="card"><div class="row"><h2 class="grow">Plans</h2><a class="btn ghost" href="#coach/flow/hard">+ Plan</a></div>
        ${(s.plans || []).length ? s.plans.map((pl) => `<div class="goal" data-plan="${pl.id}"><div class="grow"><div class="gtitle">${esc(pl.what)}</div>
          <div class="gmeta">${pl.when_text ? `When: ${esc(pl.when_text)}` : ''}${pl.due_at ? ` · ⏰ ${new Date(pl.due_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</div></div>
          <button class="btn secondary" data-pl="done">Done</button><button class="btn ghost" data-pl="missed" title="Didn’t happen — no problem">✕</button></div>`).join('')
          : '<p class="small muted">If-then plans you make with your coach appear here, and you’ll get a nudge at the time.</p>'}
        <div class="row" style="margin-top:10px"><input id="cap" placeholder="Capture anything… (it goes in your inbox)" maxlength="300"><button class="btn secondary" id="capGo">+</button></div>
        ${s.inboxCount ? `<a class="small" href="#inbox">📥 Inbox: ${s.inboxCount} item${s.inboxCount === 1 ? '' : 's'}</a>` : ''}</div>
      ${!(s.trackers || []).length || !(s.habitsToday || []).length ? `<div class="row" style="margin-bottom:14px">${!(s.habitsToday || []).length ? '<a class="btn ghost grow" href="#habits" style="text-align:center">🔁 Build a habit</a>' : ''}${!(s.trackers || []).length ? '<a class="btn ghost grow" href="#sober/new" style="text-align:center">🌱 Go alcohol-free / quit something</a>' : ''}</div>` : ''}
      <a class="card row" href="#coach" style="text-decoration:none;color:inherit">
        <span style="font-size:1.8rem">💬</span><div class="grow"><b>Talk to your coach</b><div class="small muted">Plan, get unstuck, debrief, or just think out loud. Private to you.</div></div><span>›</span></a>`;

    const petEl = document.getElementById('pet');
    if (petEl) petEl.onclick = () => { location.hash = '#shop/home'; };
    if (s.kindnesses?.length) kindnessSheet(s.kindnesses);
    $app.querySelectorAll('[data-open]').forEach((el) => el.onclick = () => { location.hash = `#sober/${el.dataset.open}`; });
    $app.querySelectorAll('[data-free]').forEach((b) => b.onclick = async () => {
      const r = await api(`/api/sober/${b.dataset.free}/day`, { body: { status: 'free' } });
      if (r.milestone) toast(`🎉 ${r.milestone.days} good days! +${r.milestone.acorns} 🌰`, 4000);
      afterEnergy(r.energy, 'Another good day 🌱');
    });
    $app.querySelectorAll('[data-hdone]').forEach((b) => b.onclick = async () => {
      const r = await api(`/api/habits/${b.dataset.hdone}/log`, { body: { status: 'done' } });
      afterEnergy(r.energy, '+3 energy');
    });
    $app.querySelectorAll('[data-plan]').forEach((row) => row.querySelectorAll('[data-pl]').forEach((b) => b.onclick = async () => {
      const r = await api(`/api/plans/commitments/${row.dataset.plan}/${b.dataset.pl}`, { body: {} });
      if (b.dataset.pl === 'done') afterEnergy(r.energy, 'Plan kept! +5 energy'); else { toast('No problem — that happens. Moved off your list.'); route(); }
    }));
    const cap = async () => { const el = document.getElementById('cap'); if (!el.value.trim()) return;
      await api('/api/plans/inbox', { body: { text: el.value } }); el.value = ''; toast('In your inbox — out of your head'); state = await api('/api/pet/state'); renderHome(); };
    document.getElementById('capGo').onclick = cap;
    document.getElementById('cap').addEventListener('keydown', (e) => { if (e.key === 'Enter') cap(); });
    bindGoals();
    document.getElementById('welcome')?.addEventListener('click', welcomeHome);
    document.getElementById('ckm')?.addEventListener('click', () => checkinSheet('morning'));
    document.getElementById('cke')?.addEventListener('click', () => checkinSheet('evening'));
    document.getElementById('mend')?.addEventListener('click', async () => {
      try { await api('/api/streak/repair', { body: {} }); toast('Mended. Gaps happen — you came back.'); route(); } catch (e) { toast(e.message); }
    });
    if (away) pollTimer = setInterval(route, 60000);
  }

  const KIND = { proud: ['🌟', 'I’m proud of you'], thinking: ['💭', 'Thinking of you'], rest: ['🛋️', 'You deserve a rest'], water: ['💧', 'Drink some water!'],
    gotthis: ['💪', 'You’ve got this'], hug: ['🤗', 'Sending a hug'], gentle: ['🌿', 'Be gentle with yourself today'], sun: ['☀️', 'Hope today is a good one'],
    enough: ['💛', 'You are enough'], breathe: ['🫧', 'Remember to breathe'], laugh: ['😄', 'This made me think of you — hope you smile'], night: ['🌙', 'Sleep well'] };
  function kindnessSheet(list) {
    sheet(`<h1>Kind words for you 💌</h1>${list.map((k) => `<div class="card" style="background:var(--bg)"><span style="font-size:1.6rem">${KIND[k.kind]?.[0] || '💛'}</span>
      <b>${esc(k.from_name)}</b>: ${esc(KIND[k.kind]?.[1] || '')}</div>`).join('')}
      <div class="row"><a class="btn secondary grow" href="#friends" id="reply" style="text-align:center;text-decoration:none">Send one back</a><button class="btn grow" id="ok">Aww, thanks</button></div>`,
    (sh, close) => {
      api('/api/social/kindness/seen', { body: {} }).catch(() => {});
      sh.querySelector('#ok').onclick = close; sh.querySelector('#reply').onclick = close;
    });
  }

  function goalRow(g) {
    const steps = g.steps || [];
    return `<div class="goal ${g.done ? 'done' : ''}" data-id="${g.id}">
      <button class="tick ${g.done ? 'done' : ''}" aria-label="${g.done ? 'Mark not done' : 'Mark done'}">${g.done ? '✓' : ''}</button>
      <div class="grow"><div class="cat">${CAT_EMOJI[g.category] || '🌿'} ${esc(g.category)}${g.source === 'coach' ? ' · from coach' : ''}</div>
        <div class="gtitle">${esc(g.title)}</div>
        ${g.why ? `<div class="gmeta">${esc(g.why)}</div>` : ''}
        ${g.partners?.length ? `<div class="gmeta">${g.partners.map((pp) => `${esc(pp.name)} ${pp.done ? '✅ done' : '⏳ not yet'}`).join(' · ')}</div>` : ''}
        ${steps.length ? `<ul class="steps">${steps.map((st, i) => `<li><input type="checkbox" data-step="${i}" ${st.done ? 'checked' : ''} id="s${g.id}${i}"><label for="s${g.id}${i}">${esc(st.text)}</label></li>`).join('')}</ul>` : ''}
      </div></div>`;
  }

  function bindGoals() {
    $app.querySelectorAll('.goal[data-id]').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('.tick').onclick = async () => {
        const done = row.classList.contains('done');
        try {
          if (done) { await api(`/api/goals/${id}/uncomplete`, { body: {} }); return route(); }
          const r = await api(`/api/goals/${id}/complete`, { body: {} });
          afterEnergy(r.energy, '+5 energy');
          showMessages(r.messages);
        } catch (e) { toast(e.message); }
      };
      row.querySelectorAll('[data-step]').forEach((cb) => cb.onchange = () => api(`/api/goals/${id}/steps/${cb.dataset.step}`, { body: {} }).catch((e) => toast(e.message)));
    });
  }

  function afterEnergy(en, msg) {
    const name = state.pet.name;
    if (en?.started) {
      sheet(`<div class="center"><div style="font-size:3rem">🎒</div><h1>${esc(name)} is off on an adventure!</h1>
        <p>Heading to <b>${esc(en.started.place)}</b>. Keep going with your day — ${esc(name)} will be back later with a story.</p>
        <button class="btn block" id="ok">Have fun, ${esc(name)}!</button></div>`, (s, close) => s.querySelector('#ok').onclick = () => { close(); route(); });
    } else {
      if (en?.away) toast(`${name} is heading home ${en.shortenedBy} min sooner`);
      else if (en) toast(msg);
      route();
    }
  }

  async function welcomeHome() {
    const btn = document.getElementById('welcome');
    btn.disabled = true; btn.textContent = 'Listening…';
    try {
      const r = await api('/api/pet/adventure/return', { body: {} });
      const p = state.pet;
      showMessages(r.messages);
      sheet(`<div class="center">${sprigOf(p, { mood: 'excited', size: 130 })}</div>
        <h1>${esc(r.story.title)}</h1><p>${esc(r.story.story)}</p>
        <div class="card" style="background:var(--bg)"><b>Found:</b> ${esc(r.story.discovery)}</div>
        ${r.grew ? `<div class="card" style="background:var(--bg)">🌱 <b>${esc(p.name)} grew into a ${esc(r.grew)}!</b></div>` : ''}
        <p class="center">+${r.acorns} 🌰${r.streakBonus ? ` <span class="small muted">(incl. ${r.streakBonus} streak bonus)</span>` : ''}</p>
        <div class="field"><label>${esc(p.name)} asks: “${esc(r.story.question)}”</label>
          <textarea id="ans" placeholder="Only if you want to — it’s saved to your evening check-in"></textarea></div>
        <button class="btn block" id="ok">Thank you, ${esc(p.name)}</button>`,
        (s, close) => s.querySelector('#ok').onclick = async () => {
          const ans = s.querySelector('#ans').value.trim();
          if (ans) await api('/api/checkins', { body: { kind: 'evening', note: `${r.story.question}\n${ans}`, mood: state.checkins.evening?.mood } }).catch(() => {});
          close(); route();
        });
    } catch (e) { toast(e.message); btn.disabled = false; }
  }

  // ---------- check-ins ----------
  async function checkinSheet(kind) {
    const { emotions } = await api('/api/checkins/options');
    let mood = null, energy = null;
    const chosen = new Set();
    const morning = kind === 'morning';
    sheet(`<h1>${morning ? '☀️ Morning check-in' : '🌙 Evening check-in'}</h1>
      <div class="field"><label>How are you feeling?</label><div class="scale" id="mood">${MOODS.map((m, i) => `<button data-v="${i + 1}" aria-label="mood ${i + 1} of 5">${m}</button>`).join('')}</div></div>
      ${morning ? `<div class="field"><label>How much energy have you got?</label><div class="scale" id="en">${ENERGIES.map((m, i) => `<button data-v="${i + 1}" aria-label="energy ${i + 1} of 5">${m}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label>Any of these?</label><div class="row wrap" id="emo">${[...emotions.good, ...emotions.hard].map((e) => `<button class="chip" data-e="${e}">${e}</button>`).join('')}</div></div>
      ${morning ? '' : `<div class="field"><label for="grat">One good thing about today</label><input id="grat" placeholder="Even a tiny one counts"></div>`}
      <div class="field"><label for="note">Anything on your mind?</label><textarea id="note" placeholder="Optional"></textarea></div>
      <button class="btn block" id="save">Save</button>`, (s, close) => {
      s.querySelectorAll('#mood button').forEach((b) => b.onclick = () => { mood = +b.dataset.v; s.querySelectorAll('#mood button').forEach((x) => x.classList.toggle('on', x === b)); });
      s.querySelectorAll('#en button').forEach((b) => b.onclick = () => { energy = +b.dataset.v; s.querySelectorAll('#en button').forEach((x) => x.classList.toggle('on', x === b)); });
      s.querySelectorAll('[data-e]').forEach((b) => b.onclick = () => { chosen.has(b.dataset.e) ? chosen.delete(b.dataset.e) : chosen.add(b.dataset.e); b.classList.toggle('on'); });
      s.querySelector('#save').onclick = async () => {
        if (!mood) return toast('Tap a face for your mood');
        try {
          const r = await api('/api/checkins', { body: { kind, mood, energy, emotions: [...chosen], note: s.querySelector('#note').value, gratitude: s.querySelector('#grat')?.value } });
          close();
          if (r.support) supportSheet();
          afterEnergy(r.energy, `+5 energy — thanks for checking in`);
        } catch (e) { toast(e.message); }
      };
    });
  }

  function supportSheet() {
    sheet(`<h1>That sounds really hard</h1>
      <p>Thank you for telling me. You don’t have to handle it alone.</p>
      <div class="card" style="background:var(--bg)"><b>If you need someone now (UK)</b><br>
        Samaritans — call <a href="tel:116123">116 123</a>, free, any time.<br>Text SHOUT to <a href="sms:85258">85258</a>.<br>
        In an emergency call <a href="tel:999">999</a>.<br><span class="small muted">Outside the UK, use your local emergency number.</span></div>
      <p class="muted small">Something small that can help: a glass of water, a breath of fresh air, or messaging one person you trust.</p>
      <button class="btn block" id="ok">Okay</button>`, (s, close) => s.querySelector('#ok').onclick = close);
  }

  // ---------- coach ----------
  async function renderCoach() {
    setTab('coach');
    const b = state.brain;
    const [{ plan }, { messages }] = await Promise.all([api('/api/coach/plan'), api('/api/coach/messages')]);
    const sources = b.capabilities?.calendar ? 'your calendar, email and tasks' : 'your goals and check-ins';
    $app.innerHTML = `
      <div class="card"><h2>🧭 Today’s plan</h2><div id="plan"></div></div>
      <div class="card"><h2>💬 Talk to ${esc(b.label)}</h2>
        <div class="chat" id="chat">${messages.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('') || `<p class="muted small">Stuck, overwhelmed or can’t start? Say so here.</p>`}</div>
        <div class="row" style="margin-top:10px"><textarea id="say" rows="1" style="min-height:48px" placeholder="Say anything…"></textarea><button class="btn" id="send">Send</button></div></div>`;
    const chat = document.getElementById('chat');
    chat.scrollTop = chat.scrollHeight;

    const drawPlan = (pl) => {
      const el = document.getElementById('plan');
      if (!el) return;
      if (!pl) {
        el.innerHTML = `<p class="muted">${esc(b.label)} will look at ${sources} and suggest a few small, doable things.</p>
          <button class="btn block" id="mk" ${b.name === 'none' ? 'disabled' : ''}>Plan my day</button>`;
        el.querySelector('#mk').onclick = start;
      } else if (pl.status === 'pending') {
        el.innerHTML = `<p class="typing">${esc(b.label)} is looking at ${sources}… this can take a minute.</p>`;
        pollTimer = setTimeout(async () => drawPlan((await api('/api/coach/plan')).plan), 4000);
      } else if (pl.status === 'failed') {
        el.innerHTML = `<p>That didn’t work this time (${esc(pl.error || 'unknown')}).</p><button class="btn secondary block" id="mk">Try again</button>`;
        el.querySelector('#mk').onclick = start;
      } else {
        el.innerHTML = `<p>${esc(pl.summary)}</p>` + pl.suggestions.map((sg, i) => `
          <div class="suggestion"><div class="cat">${CAT_EMOJI[sg.category] || '🌿'} ${esc(sg.category)}</div><b>${esc(sg.title)}</b>
            <div class="gmeta">${esc(sg.why)}</div>
            ${sg.steps.length ? `<ol class="small" style="margin:.4em 0 .6em;padding-left:1.2em">${sg.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
            ${sg.accepted ? '<span class="small muted">✓ Added to today</span>' : `<button class="btn secondary" data-i="${i}">Add to today</button>`}</div>`).join('') +
          `<button class="btn ghost block" id="mk">Ask again</button>`;
        el.querySelectorAll('[data-i]').forEach((btn) => btn.onclick = async () => {
          try { await api(`/api/coach/plan/${pl.id}/accept/${btn.dataset.i}`, { body: {} }); toast('Added to today'); drawPlan((await api('/api/coach/plan')).plan); }
          catch (e) { toast(e.message); }
        });
        el.querySelector('#mk').onclick = start;
      }
    };
    const start = async () => { try { await api('/api/coach/plan', { body: {} }); drawPlan({ status: 'pending' }); } catch (e) { toast(e.message); } };
    drawPlan(plan);

    const send = async () => {
      const ta = document.getElementById('say');
      const text = ta.value.trim();
      if (!text) return;
      ta.value = '';
      chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(text)}</div><div class="msg assistant typing" id="typing">thinking…</div>`);
      chat.scrollTop = chat.scrollHeight;
      try {
        const r = await api('/api/coach/chat', { body: { text } });
        document.getElementById('typing').outerHTML = `<div class="msg assistant">${esc(r.reply)}</div>`;
      } catch (e) { document.getElementById('typing').outerHTML = `<div class="msg assistant">${esc(e.message)}</div>`; }
      chat.scrollTop = chat.scrollHeight;
    };
    document.getElementById('send').onclick = send;
    document.getElementById('say').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  }

  // ---------- goals ----------
  async function renderGoals() {
    setTab('goals');
    const { goals, categories, suggestions } = await api('/api/goals');
    const daysLabel = (g) => g.once_on ? `just ${g.once_on}` : g.days.length === 7 ? 'every day' : g.days.length ? g.days.map((d) => DAY_NAMES[d]).join(' ') : 'no days';
    $app.innerHTML = `
      <div class="card"><div class="row"><h2 class="grow">Your goals</h2><button class="btn" id="add">+ New</button></div>
        ${goals.length ? goals.map((g) => `<div class="goal" data-id="${g.id}"><div class="grow"><div class="cat">${CAT_EMOJI[g.category] || '🌿'} ${esc(g.category)}</div>
          <div class="gtitle">${esc(g.title)}</div><div class="gmeta">${daysLabel(g)}</div></div><button class="btn ghost" data-edit="${g.id}">Edit</button></div>`).join('') : '<p class="muted">No goals yet. Start with one from the ideas below.</p>'}</div>
      <div class="card"><h2>Ideas</h2><p class="small muted">Tap one to add it for every day. Small is the point.</p>
        ${Object.entries(suggestions).map(([cat, list]) => `<h3 style="margin-top:12px">${CAT_EMOJI[cat]} ${esc(cat)}</h3><div class="row wrap">${list.map((t) => `<button class="chip" data-sug="${esc(t)}" data-cat="${cat}">${esc(t)}</button>`).join('')}</div>`).join('')}</div>`;
    document.getElementById('add').onclick = () => goalSheet(null, categories);
    $app.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => goalSheet(goals.find((g) => g.id === b.dataset.edit), categories));
    $app.querySelectorAll('[data-sug]').forEach((b) => b.onclick = async () => {
      try { await api('/api/goals', { body: { title: b.dataset.sug, category: b.dataset.cat, source: 'suggestion' } }); toast('Added'); renderGoals(); state = await api('/api/pet/state'); }
      catch (e) { toast(e.message); }
    });
  }

  function goalSheet(g, categories) {
    const days = new Set(g ? g.days : [0, 1, 2, 3, 4, 5, 6]);
    sheet(`<h1>${g ? 'Edit goal' : 'New goal'}</h1>
      <div class="field"><label for="gt">What’s the small thing?</label><input id="gt" maxlength="80" value="${esc(g?.title || '')}" placeholder="e.g. Take my meds"></div>
      <div class="field"><label for="gc">Kind</label><select id="gc">${categories.map((c) => `<option ${g?.category === c ? 'selected' : ''} value="${c}">${CAT_EMOJI[c]} ${c}</option>`).join('')}</select></div>
      <div class="field"><label>Which days?</label><div class="row">${DAYS.map((d, i) => `<button class="chip ${days.has(i) ? 'on' : ''}" data-d="${i}" aria-label="${DAY_NAMES[i]}">${d}</button>`).join('')}</div></div>
      <div class="field"><label for="gs">Tiny steps (one per line, optional)</label><textarea id="gs" placeholder="Fill the glass\nDrink it">${esc((g?.steps || []).map((s) => s.text).join('\n'))}</textarea></div>
      <button class="btn block" id="save">Save</button>
      ${g ? '<button class="btn ghost block" id="del">Remove this goal</button>' : ''}`, (s, close) => {
      s.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { const d = +b.dataset.d; days.has(d) ? days.delete(d) : days.add(d); b.classList.toggle('on'); });
      s.querySelector('#save').onclick = async () => {
        const body = { title: s.querySelector('#gt').value, category: s.querySelector('#gc').value, days: [...days].sort(),
          once_on: g?.once_on || null,
          steps: s.querySelector('#gs').value.split('\n').map((t) => t.trim()).filter(Boolean).map((text) => ({ text, done: false })) };
        try { await api(g ? `/api/goals/${g.id}` : '/api/goals', { method: g ? 'PUT' : 'POST', body }); close(); route(); }
        catch (e) { toast(e.message); }
      };
      s.querySelector('#del')?.addEventListener('click', async () => {
        if (!confirm('Remove this goal? Your past progress is kept.')) return;
        await api(`/api/goals/${g.id}`, { method: 'DELETE' }); close(); route();
      });
    });
  }

  // ---------- journal (adventures) ----------
  async function renderJournal() {
    setTab('journal');
    const { adventures } = await api('/api/pet/adventures');
    const p = state.pet;
    $app.innerHTML = `<h1>${esc(p.name)}’s adventures</h1>
      ${adventures.length ? adventures.map((a) => `<div class="card"><div class="small muted">${new Date(a.returned_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${esc(a.place)}</div>
        <h3>${esc(a.story?.title)}</h3><p>${esc(a.story?.story)}</p><div class="small"><b>Found:</b> ${esc(a.story?.discovery)} · +${a.acorns} 🌰</div></div>`).join('')
        : `<div class="card center">${Sprig.sprig({ colour: p.colour, stage: p.stage.key, mood: 'calm', size: 120 })}<p class="muted">No adventures yet. Fill ${esc(p.name)}’s energy bar and they’ll set off.</p></div>`}`;
  }

  // ---------- me / settings ----------
  function renderMe() {
    setTab('me');
    const s = state, st = s.streak;
    const levels = { gentle: 'Gentle — 1 thing a day', steady: 'Steady — 2 things', keen: 'Keen — 3 things', blazing: 'Blazing — 4+ things' };
    $app.innerHTML = `
      <div class="card"><h2>${esc(s.pet.name)}</h2><p class="small muted">${esc(s.pet.stage.name)} · ${s.pet.adventures} adventures${s.pet.stage.next ? ` · grows into a ${esc(s.pet.stage.next.name)} at ${s.pet.stage.next.at}` : ''} · ${esc(s.pet.pronouns)}</p></div>
      <div class="card"><h2>Streaks</h2>
        <p class="small muted">Optional. Missing days never hurts ${esc(s.pet.name)}. You can pause any time, and short gaps can be mended.</p>
        <label class="row"><input type="checkbox" id="stOn" style="width:22px;height:22px" ${st.enabled ? 'checked' : ''}><span>Show my streak</span></label>
        ${st.enabled ? `<div class="field"><label for="lvl">Daily aim</label><select id="lvl">${Object.entries(levels).map(([k, v]) => `<option value="${k}" ${st.level === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <button class="btn secondary block" id="pause">${st.paused ? 'Resume streak' : 'Pause streak (holiday, ill, rough patch)'}</button>` : ''}</div>
      <div class="card"><div class="grid">
        <a class="tile" href="#goals"><span class="em">✅</span><b>My goals</b><span class="small muted">Add, edit, days</span></a>
        <a class="tile" href="#shop"><span class="em">🛍️</span><b>Shop & wardrobe</b><span class="small muted">Outfits, colours, home</span></a>
        <a class="tile" href="#journal"><span class="em">📖</span><b>Adventures</b><span class="small muted">${s.pet.adventures} so far</span></a>
        <a class="tile" href="#explore/insights"><span class="em">📈</span><b>Insights</b><span class="small muted">Mood & patterns</span></a>
        <a class="tile" href="#safety"><span class="em">🛟</span><b>Safety plan</b><span class="small muted">For hard moments</span></a>
        <a class="tile" href="#privacy"><span class="em">🔒</span><b>Coach & privacy</b><span class="small muted">What it knows, export, delete</span></a>
        <a class="tile" href="#report"><span class="em">📄</span><b>Share with GP / therapist</b><span class="small muted">PDF of what you choose</span></a>
        <a class="tile" href="#inbox"><span class="em">📥</span><b>Inbox</b><span class="small muted">Everything you’ve captured</span></a></div></div>
      <div class="card"><h2>🔔 Nudges</h2>
        <p class="small muted">A gentle reminder to check in, and a ping when ${esc(s.pet.name)} gets home. Nothing else, ever.</p>
        ${'Notification' in window && 'PushManager' in window ? `
        <label class="row"><input type="checkbox" id="nOn" style="width:22px;height:22px" ${(s.user.settings || {}).nudges ? 'checked' : ''}><span>Send me nudges on this device</span></label>
        <div class="row" style="margin-top:10px"><div class="grow field"><label for="mt">Morning</label><input type="time" id="mt" value="${esc((s.user.settings || {}).morning_time || '09:00')}"></div>
          <div class="grow field"><label for="et">Evening</label><input type="time" id="et" value="${esc((s.user.settings || {}).evening_time || '20:30')}"></div></div>
        <div class="row" style="margin-top:6px"><div class="grow field"><label for="cap">Max reminders a day</label><select id="capN">${[2, 3, 4, 6, 8].map((n) => `<option ${((s.user.settings || {}).push_cap || 4) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <div class="row"><button class="btn ghost" id="nTest">Send a test</button><button class="btn ghost" id="quiet">${(s.user.settings || {}).quiet_day === s.today ? '🔔 Un-quiet today' : '🤫 Quiet today'}</button></div>` : '<p class="small">This browser can’t do notifications. On iPhone, add ${APP} to your Home Screen first.</p>'}</div>
      <div class="card"><h2>🔒 App lock</h2>
        <p class="small muted">Ask for your PIN when the app has been away for a while — useful if others use your phone. Works offline.</p>
        <div class="field"><label for="lockM">Lock after</label><select id="lockM">${[['off', 'Never'], [0, 'Every time I leave'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [60, '1 hour']].map(([v, l]) => `<option value="${v}" ${String(F.lock().lockMins()) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${F.lock().hasPin() ? '<button class="btn ghost" id="lockNow">Lock now</button>' : '<button class="btn secondary" id="lockSet">Turn on (confirm your PIN)</button>'}
        <button class="btn ghost" id="pinChg">Change PIN</button></div>
      <div class="card"><h2>Coach</h2><p class="small">Connected to <b>${esc(s.brain.label)}</b>${s.brain.capabilities?.calendar ? ' — can see your calendar, email and tasks.' : '.'}</p></div>
      ${s.isOwner ? `<div class="card"><h2>👪 Household</h2><p class="small muted">Add someone to this server. They get their own sprig, and their check-ins and chats stay private to them.</p>
        <div class="row"><input id="hn" placeholder="Name" maxlength="40"><input id="hp" placeholder="PIN" inputmode="numeric" maxlength="8" style="max-width:110px"></div>
        <button class="btn secondary block" id="hAdd" style="margin-top:10px">Add person</button></div>` : ''}
      <div class="card"><button class="btn ghost block" id="out">Sign out</button>
        <p class="small muted center">${esc(APP)} ${esc(window.__BUILD__?.version || '')}</p></div>`;
    document.getElementById('stOn').onchange = async (e) => { await api('/api/streak/settings', { body: { enabled: e.target.checked } }); state = await api('/api/pet/state'); renderMe(); };
    document.getElementById('lvl')?.addEventListener('change', async (e) => { await api('/api/streak/settings', { body: { level: e.target.value } }); toast('Saved'); });
    document.getElementById('pause')?.addEventListener('click', async () => {
      await api(st.paused ? '/api/streak/resume' : '/api/streak/pause', { body: {} });
      toast(st.paused ? 'Welcome back' : 'Paused. Look after yourself.'); state = await api('/api/pet/state'); renderMe();
    });
    document.getElementById('out').onclick = async () => { await api('/api/auth/logout', { body: {} }); location.hash = '#login'; route(); };
    document.getElementById('nOn')?.addEventListener('change', async (e) => {
      try {
        if (e.target.checked) await enableNudges(); else await api('/api/push/settings', { body: { nudges: false } });
        toast(e.target.checked ? 'Nudges on' : 'Nudges off');
      } catch (err) { e.target.checked = false; toast(err.message); }
    });
    ['mt', 'et'].forEach((id) => document.getElementById(id)?.addEventListener('change', () =>
      api('/api/push/settings', { body: { morning_time: document.getElementById('mt').value, evening_time: document.getElementById('et').value } }).then(() => toast('Saved'))));
    document.getElementById('nTest')?.addEventListener('click', async () => {
      const r = await api('/api/push/test', { body: {} }); toast(r.devices ? 'Sent!' : 'Turn nudges on first');
    });
    document.getElementById('capN')?.addEventListener('change', (e) => api('/api/push/settings', { body: { push_cap: +e.target.value } }).then(() => toast('Saved')));
    document.getElementById('quiet')?.addEventListener('click', async () => {
      const on = (s.user.settings || {}).quiet_day !== s.today;
      await api('/api/push/settings', { body: { quiet_today: on } }); toast(on ? 'Quiet for the rest of today' : 'Reminders back on'); state = await api('/api/pet/state'); renderMe();
    });
    document.getElementById('lockM').onchange = (e) => { F.lock().setLockMins(e.target.value === 'off' ? 'off' : +e.target.value); toast('Saved'); };
    document.getElementById('lockNow')?.addEventListener('click', () => F.lock().showLock());
    document.getElementById('lockSet')?.addEventListener('click', () => {
      sheet(`<h1>Confirm your PIN</h1><input id="lp" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"><div style="height:10px"></div><button class="btn block" id="ok">Turn on</button>`, (sh, close) => {
        sh.querySelector('#ok').onclick = async () => {
          const pin = sh.querySelector('#lp').value;
          try { await api('/api/auth/verify-pin', { body: { pin } }); await F.lock().rememberPin(pin); close(); toast('App lock on'); renderMe(); }
          catch (e) { toast(e.message); }
        };
      });
    });
    document.getElementById('pinChg').onclick = () => {
      sheet(`<h1>Change PIN</h1><div class="field"><label for="cp0">Current PIN</label><input id="cp0" type="password" inputmode="numeric" maxlength="8"></div>
        <div class="field"><label for="cp1">New PIN (4–8 digits)</label><input id="cp1" type="password" inputmode="numeric" maxlength="8"></div>
        <button class="btn block" id="ok">Change</button>`, (sh, close) => {
        sh.querySelector('#ok').onclick = async () => {
          const pin = sh.querySelector('#cp0').value, newPin = sh.querySelector('#cp1').value;
          try {
            await api('/api/auth/change-pin', { body: { pin, new_pin: newPin } });
            if (F.lock().hasPin()) await F.lock().rememberPin(newPin);
            close(); toast('PIN changed');
          } catch (e) { toast(e.message); }
        };
      });
    };
    document.getElementById('hAdd')?.addEventListener('click', async () => {
      try { await api('/api/social/household', { body: { name: hn.value, pin: hp.value } }); toast(`${hn.value} added — they can sign in now`); hn.value = ''; hp.value = ''; }
      catch (e) { toast(e.message); }
    });
  }

  async function enableNudges() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(`Notifications are blocked for ${APP} in your browser settings`);
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api('/api/push/key');
    const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
    await api('/api/push/subscribe', { body: { subscription: sub.toJSON() } });
  }

  // ---------- service worker (tap-to-refresh on update) ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const b = document.createElement('div');
            b.className = 'update-banner'; b.textContent = `A new version of ${APP} is ready — tap to refresh`;
            b.onclick = () => { nw.postMessage('skipWaiting'); location.reload(); };
            document.body.appendChild(b);
          }
        });
      });
    }).catch(() => {});
  }

  if (shouldLock()) showLock();
  flushOutbox().catch(() => {});
  route();
})();
