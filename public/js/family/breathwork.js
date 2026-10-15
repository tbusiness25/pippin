/*
 * Explore → 🌬️ Breathwork: guided sessions with a breathing orb, soft sound cues (and optional voice), a
 * stopwatch for breath-holds, an always-there "Ease off" button, before/after "how busy is your head", and
 * history. Intense practices stay locked until the one-time safety check. (src/routes/breathwork.js)
 */
(function () {
  const { api, esc, toast } = F;
  const $app = document.getElementById('app');
  const A = '/api/breathwork';
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(`bw:${k}`)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(`bw:${k}`, JSON.stringify(v)); } catch { /* private mode */ } } };
  const back = (h = '#breathwork', l = 'Breathwork') => `<a href="${h}" class="btn ghost" style="padding-left:0">‹ ${l}</a>`;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const HEAD = ['', 'Racing', 'Busy', 'In between', 'Calm', 'Quiet'];
  let d = null;           // GET /api/breathwork
  let run = null;         // the live session (so leaving the page stops it)

  // ---------------------------------------------------------------- sound, voice, screen
  let ctx = null;
  const audioOn = () => store.get('sound', true), voiceOn = () => store.get('voice', false);
  function tone(from, to, secs, vol = 0.06) {
    if (!audioOn()) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(from, t); o.frequency.linearRampToValueAtTime(to, t + secs);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.4, secs / 3)); g.gain.linearRampToValueAtTime(0, t + secs);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + secs + 0.05);
    } catch { /* no audio */ }
  }
  const cueIn = (s) => tone(196, 294, s), cueOut = (s) => tone(294, 175, s), bell = () => { tone(523, 523, 1.2, 0.05); setTimeout(() => tone(659, 659, 1.6, 0.04), 300); };
  function say(text) {
    if (!voiceOn() || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 0.9; const v = speechSynthesis.getVoices().find((x) => /en-GB/.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch { /* */ }
  }
  let lock = null;
  async function awake(on) { try { if (on && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); else if (!on && lock) { await lock.release(); lock = null; } } catch { /* */ } }
  window.addEventListener('hashchange', () => { if (run && !location.hash.startsWith('#breathwork/go')) stopRun(); });
  function stopRun() { if (!run) return; run.stopped = true; run.timers.forEach(clearTimeout); run.timers = []; awake(false); try { speechSynthesis.cancel(); } catch { /* */ } run = null; }
  const wait = (ms) => new Promise((r) => { if (!run) return r(); run.timers.push(setTimeout(r, ms)); });

  // ---------------------------------------------------------------- home
  async function home(rest) {
    F.setTab('explore'); stopRun();
    $app.innerHTML = `${back('#explore', 'Explore')}<h1>🌬️ Breathwork</h1><p class="muted">Loading…</p>`;
    try { d = await api(A); } catch (e) { $app.querySelector('p').textContent = e.message; return; }
    if (rest === 'learn') return learn();
    if (rest === 'safety') return safety();
    if (rest === 'history') return history();
    if (rest && rest.startsWith('go/')) return prepare(rest.slice(3));
    const P = d.content.practices;
    const card = (p) => `<a class="card row" href="#breathwork/go/${p.id}" style="text-decoration:none;color:inherit"><span style="font-size:1.7rem">${p.emoji}</span>
      <div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.about)}</div></div><span>${p.group === 'deep' && !d.intenseUnlocked ? '🔒' : '›'}</span></a>`;
    const helps = d.stats.filter((s) => s.rated >= 2).sort((a, b) => b.change - a.change);
    $app.innerHTML = `${back('#explore', 'Explore')}<h1>🌬️ Breathwork</h1>
      <p class="muted">Everyday breaths for a steadier, quieter head — and deeper sessions for when you want to go further.</p>
      <div class="row wrap" style="margin-bottom:12px"><a class="chip" href="#breathwork/learn" style="text-decoration:none">📖 The science</a><a class="chip" href="#breathwork/history" style="text-decoration:none">📈 My sessions</a>
        <label class="chip"><input type="checkbox" id="bwSound" ${audioOn() ? 'checked' : ''}> Sound cues</label><label class="chip"><input type="checkbox" id="bwVoice" ${voiceOn() ? 'checked' : ''}> Voice guide</label></div>
      ${helps.length ? `<div class="card small"><b>What helps you most:</b> ${helps.slice(0, 3).map((s) => `${esc((P.find((p) => p.id === s.practice) || {}).name || s.practice)} (${s.change >= 0 ? '+' : ''}${s.change} on the busy-head scale, ${s.rated} sessions)`).join(' · ')}</div>` : ''}
      <h2>Everyday</h2><p class="small muted" style="margin-top:-6px">Daily, any time — at your desk, before a hard task, in bed.</p>
      ${P.filter((p) => p.group === 'everyday').map(card).join('')}
      <h2>Deep sessions</h2><p class="small muted" style="margin-top:-6px">Intense and powerful — lying down, a few times a week.</p>
      ${d.intenseUnlocked ? '' : `<div class="card"><p style="margin-top:0"><b>One quick safety check first.</b> These change your blood chemistry on purpose — they’re safe for most people lying down on dry land, but not for everyone.</p><a class="btn" href="#breathwork/safety">Do the safety check (1 minute)</a>
        ${d.safety && !d.safety.cleared ? `<p class="small muted">${esc(d.content.blockedMessage)}</p>` : ''}</div>`}
      ${P.filter((p) => p.group === 'deep').map(card).join('')}`;
    document.getElementById('bwSound').onchange = (e) => store.set('sound', e.target.checked);
    document.getElementById('bwVoice').onchange = (e) => store.set('voice', e.target.checked);
  }

  function learn() {
    $app.innerHTML = `${back()}<h1>📖 The science</h1>${d.content.learn.map((c) => `<div class="card"><h2 style="margin-top:0">${esc(c.title)}</h2><p>${esc(c.body)}</p><p class="small muted" style="margin-bottom:0">Source: ${esc(c.source)}</p></div>`).join('')}`;
  }

  function safety() {
    const S = d.content.safety, R = d.content.rules;
    $app.innerHTML = `${back()}<h1>Safety check</h1><p class="muted">Takes a minute. Asked once a year. Your answers stay on this server.</p>
      <div class="card"><h2 style="margin-top:0">Does any of this apply to you?</h2>${S.map((q) => `<label class="row" style="padding:6px 0;align-items:flex-start"><input type="checkbox" data-q="${q.id}" style="width:22px;height:22px;flex:none"><span>${esc(q.q)}</span></label>`).join('')}</div>
      <div class="card"><h2 style="margin-top:0">The rules</h2>${R.map((r) => `<label class="row" style="padding:6px 0;align-items:flex-start"><input type="checkbox" data-r="${r.id}" style="width:22px;height:22px;flex:none"><span>${esc(r.text)}</span></label>`).join('')}
        <p class="small muted">Tick each one to agree.</p></div>
      <button class="btn block" id="bwSave">Save</button><div id="bwOut"></div>`;
    document.getElementById('bwSave').onclick = async () => {
      const answers = {}, rules = {};
      $app.querySelectorAll('[data-q]').forEach((x) => { answers[x.dataset.q] = x.checked; });
      $app.querySelectorAll('[data-r]').forEach((x) => { rules[x.dataset.r] = x.checked; });
      try {
        const r = await api(`${A}/safety`, { body: { answers, rules } });
        const out = document.getElementById('bwOut');
        if (r.cleared) {
          out.innerHTML = `<div class="card"><p style="margin-top:0">✓ Deep sessions unlocked.</p>${r.cautions.map((c) => `<p class="small">⚠ ${esc((S.find((q) => q.id === c) || {}).caution || '')}</p>`).join('')}<a class="btn" href="#breathwork">Back to breathwork</a></div>`;
        } else if (!r.rulesOk) out.innerHTML = '<div class="card"><p style="margin:0">Please tick all the rules — they’re what keeps the intense practices safe.</p></div>';
        else out.innerHTML = `<div class="card"><p style="margin:0">${esc(d.content.blockedMessage)}</p></div>`;
      } catch (e) { toast(e.message); }
    };
  }

  // ---------------------------------------------------------------- before a session
  function rateRow(id, label) {
    return `<div class="fld"><span class="small muted">${label}</span><div class="row wrap" id="${id}">${[1, 2, 3, 4, 5].map((n) => `<button class="chip" data-v="${n}">${n} · ${HEAD[n]}</button>`).join('')}</div></div>`;
  }
  function wireRate(id) {
    let v = null; const el = document.getElementById(id);
    el.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { v = +b.dataset.v; el.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    return () => v;
  }
  function prepare(id) {
    const p = d.content.practices.find((x) => x.id === id);
    if (!p) { location.hash = '#breathwork'; return; }
    if (p.group === 'deep' && !d.intenseUnlocked) { location.hash = '#breathwork/safety'; return; }
    const deep = p.group === 'deep';
    const opt = p.type === 'power'
      ? `<div class="fld"><span class="small muted">Breaths per round</span><div class="row wrap" id="bwN">${p.breaths.map((n) => `<button class="chip ${n === store.get('breaths', p.defaultBreaths) ? 'on' : ''}" data-v="${n}">${n}</button>`).join('')}</div></div>
         <div class="fld"><span class="small muted">Rounds</span><div class="row wrap" id="bwR">${p.rounds.map((n) => `<button class="chip ${n === store.get('rounds', p.defaultRounds) ? 'on' : ''}" data-v="${n}">${n}</button>`).join('')}</div></div>`
      : `<div class="fld"><span class="small muted">Length</span><div class="row wrap" id="bwM">${p.minutes.map((n) => `<button class="chip ${n === store.get(`min:${p.id}`, p.defaultMinutes) ? 'on' : ''}" data-v="${n}">${n} min</button>`).join('')}</div></div>`;
    $app.innerHTML = `${back()}<h1>${p.emoji} ${esc(p.name)}</h1><p>${esc(p.about)}</p>
      <div class="card"><b>How</b><p class="small" style="margin-bottom:0">${esc(p.how)}</p></div>
      ${deep && d.intenseToday ? '<div class="card small">You’ve already done a deep session today — your nervous system has had its workout. A slow everyday one is the kinder choice. (You can still go ahead.)</div>' : ''}
      <div class="card">${opt}${rateRow('bwBefore', 'Right now my head is…')}
        ${deep ? `<label class="row" style="align-items:flex-start;margin-top:6px"><input type="checkbox" id="bwSafe" style="width:22px;height:22px;flex:none"><span class="small">I’m lying down (or sitting well supported), not in water, not driving, and haven’t had alcohol or drugs today.</span></label>` : ''}
        <button class="btn block" id="bwGo" style="margin-top:10px">Start</button></div>`;
    const pickOne = (gid, key) => { const el = document.getElementById(gid); if (!el) return; el.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { store.set(key, +b.dataset.v); el.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); }; }); };
    pickOne('bwN', 'breaths'); pickOne('bwR', 'rounds'); pickOne('bwM', `min:${p.id}`);
    const before = wireRate('bwBefore');
    document.getElementById('bwGo').onclick = () => {
      if (deep && !document.getElementById('bwSafe').checked) return toast('Tick the safety line first — lying down, dry land, sober');
      const b = before();
      if (p.type === 'power') return power(p, b);
      if (p.type === 'connected') return connected(p, b);
      return pattern(p, b);
    };
  }

  // ---------------------------------------------------------------- the session screen
  function stage(p, extra = '') {
    $app.innerHTML = `<div class="bw-stage"><div class="row"><b class="grow">${p.emoji} ${esc(p.name)}</b><button class="btn ghost" id="bwStop">End</button></div>
      <div class="bw-sub" id="bwTop"></div><div class="breath bw-orb" id="bwOrb">Ready</div><div class="bw-cue" id="bwCue"></div><div class="bigtime" id="bwTime"></div>
      ${extra}<button class="btn secondary block" id="bwEase">Ease off — slow down</button></div>`;
    document.getElementById('bwStop').onclick = () => { if (run) run.end(true); };
    return { orb: document.getElementById('bwOrb'), cue: document.getElementById('bwCue'), time: document.getElementById('bwTime'), top: document.getElementById('bwTop') };
  }
  function breath(ui, kind, secs, label) {
    ui.orb.style.transitionDuration = `${secs}s`;
    ui.orb.style.transform = kind === 'in' ? 'scale(1.35)' : kind === 'out' ? 'scale(0.8)' : ui.orb.style.transform;
    if (label != null) ui.orb.textContent = label;
    if (kind === 'in') cueIn(secs); else if (kind === 'out') cueOut(secs);
    if (navigator.vibrate && kind === 'in' && secs >= 3) navigator.vibrate(30);
  }
  // Ease off: a minute of long out-breaths, then continue or finish.
  async function easeOff(ui) {
    run.eased = true;
    ui.top.textContent = 'Easing off — slow, quiet breaths through your nose. Tingling and light-headedness fade within a minute or two.';
    say('Slow down. Breathe in gently through your nose, and let a long breath out.');
    const until = Date.now() + 60000;
    while (run && !run.stopped && Date.now() < until) {
      ui.time.textContent = mmss((until - Date.now()) / 1000);
      breath(ui, 'in', 4, 'In (nose)'); ui.cue.textContent = 'Breathe in gently'; await wait(4000);
      if (!run) return false;
      breath(ui, 'out', 7, 'Slowly out'); ui.cue.textContent = 'Long, slow out-breath'; await wait(7000);
    }
    return !!run;
  }

  async function finish(p, before, extra) {
    if (!run) return;
    const secs = Math.round((Date.now() - run.started) / 1000), eased = run.eased;
    stopRun(); bell();
    let saved = null;
    try { saved = await api(`${A}/sessions`, { body: { practice: p.id, seconds: secs, before, eased_off: eased, rounds: extra.rounds || [] } }); F.showMessages && F.showMessages(saved.messages); } catch (e) { toast(e.message); }
    const prev = (d.recent || []).find((s) => s.practice === 'power' && s.rounds && s.rounds.length);
    const best = extra.rounds && extra.rounds.length ? Math.max(...extra.rounds) : null;
    $app.innerHTML = `${back()}<h1>${p.emoji} Done</h1>
      <div class="card"><p style="margin-top:0">${mmss(secs)} of ${esc(p.name.toLowerCase())}${eased ? ' (with a breather)' : ''}.</p>
        ${extra.rounds && extra.rounds.length ? `<p>Breath-holds: <b>${extra.rounds.map(mmss).join(' · ')}</b>${prev ? ` <span class="small muted">(last time best ${mmss(Math.max(...prev.rounds))})</span>` : ''}</p>
          <p class="small muted">Holds get longer with practice, but it isn’t a contest — never push past the first strong urge to breathe in water or anywhere unsafe.</p>` : ''}
        ${rateRow('bwAfter', 'Now my head is…')}<label class="fld"><span class="small muted">Anything you noticed? (optional)</span><textarea id="bwNote" rows="2"></textarea></label>
        <button class="btn block" id="bwDone">Save</button></div>`;
    const after = wireRate('bwAfter');
    document.getElementById('bwDone').onclick = async () => {
      if (saved && saved.id) await api(`${A}/sessions/${saved.id}`, { method: 'PATCH', body: { after: after(), note: document.getElementById('bwNote').value || null } }).catch(() => {});
      toast(best ? `Saved — best hold ${mmss(best)}` : 'Saved'); location.hash = '#breathwork';
    };
  }

  // patterns: repeat steps for N minutes
  async function pattern(p, before) {
    const mins = store.get(`min:${p.id}`, p.defaultMinutes), total = mins * 60;
    const ui = stage(p); document.getElementById('bwEase').style.display = 'none';
    run = { started: Date.now(), timers: [], eased: false, stopped: false, end: () => finish(p, before, {}) };
    awake(true); say(p.steps[0][2]);
    let i = 0;
    while (run && (Date.now() - run.started) / 1000 < total) {
      const [kind, secs, label] = p.steps[i % p.steps.length];
      ui.time.textContent = `${mmss(total - (Date.now() - run.started) / 1000)}`;
      breath(ui, kind, secs, label); ui.cue.textContent = ''; i++;
      await wait(secs * 1000);
    }
    if (run) finish(p, before, {});
  }

  // power breathing: rounds of fast breaths → empty-lung hold (stopwatch) → 15-s recovery hold
  async function power(p, before) {
    const N = store.get('breaths', p.defaultBreaths), R = store.get('rounds', p.defaultRounds);
    const ui = stage(p, '<button class="btn block bw-tap" id="bwTap" style="display:none">I need to breathe — breathe in</button>');
    const rounds = [];
    run = { started: Date.now(), timers: [], eased: false, stopped: false, end: () => finish(p, before, { rounds }) };
    awake(true);
    let easing = false;
    document.getElementById('bwEase').onclick = async () => { if (easing) return; easing = true; run.timers.forEach(clearTimeout); const ok = await easeOff(ui); if (ok) finish(p, before, { rounds }); };
    for (let r = 1; r <= R && run && !easing; r++) {
      ui.top.textContent = `Round ${r} of ${R}`;
      say(r === 1 ? 'Breathe in fully, and let it go. Again.' : `Round ${r}. Deep breaths again.`);
      for (let n = 1; n <= N && run && !easing; n++) {
        ui.time.textContent = `${n} / ${N}`;
        ui.cue.textContent = n > N - 3 ? 'Last few…' : 'In fully — let it go';
        breath(ui, 'in', p.pace.in, 'In'); await wait(p.pace.in * 1000);
        if (!run || easing) break;
        breath(ui, 'out', p.pace.out, 'Let go'); await wait(p.pace.out * 1000);
      }
      if (!run || easing) return;
      // hold on empty lungs
      say('Let it all out, and hold.'); breath(ui, 'out', 1.5, 'Hold'); ui.cue.textContent = 'Breathe out and hold with empty lungs. Relax. Tap when you need to breathe.';
      const holdStart = Date.now(); const tap = document.getElementById('bwTap'); tap.style.display = 'block';
      await new Promise((resolve) => {
        const tick = () => { if (!run || easing) return resolve(); const s = (Date.now() - holdStart) / 1000; ui.time.textContent = mmss(s);
          if (Math.floor(s) > 0 && Math.floor(s) % 30 === 0 && Math.abs(s - Math.floor(s)) < 0.25) tone(440, 440, 0.4, 0.03);
          if (s >= p.maxHold) { say('Breathe in now.'); return resolve(); } run.timers.push(setTimeout(tick, 250)); };
        tap.onclick = () => resolve(); tick();
      });
      tap.style.display = 'none';
      if (!run || easing) return;
      rounds.push(Math.round((Date.now() - holdStart) / 1000));
      // recovery hold
      say('Big breath in, and hold.'); breath(ui, 'in', 2, 'In & hold'); ui.cue.textContent = 'Big breath in — hold it';
      for (let s = p.recovery; s > 0 && run && !easing; s--) { ui.time.textContent = `${s}`; await wait(1000); }
      if (!run || easing) return;
      breath(ui, 'out', 2.5, 'Let go'); say('And let go.'); ui.cue.textContent = ''; await wait(3500);
    }
    if (!run || easing) return;
    // quiet minute
    ui.top.textContent = 'Lie still and notice'; ui.cue.textContent = 'Breathe normally. Just notice what’s here.'; ui.orb.textContent = 'Rest'; ui.orb.style.transform = 'scale(1)';
    say('Breathe normally. Lie still, and just notice.');
    for (let s = 60; s > 0 && run; s--) { ui.time.textContent = mmss(s); await wait(1000); }
    if (run) finish(p, before, { rounds });
  }

  // connected breathing: continuous circle, no pauses, then integration
  async function connected(p, before) {
    const mins = store.get(`min:${p.id}`, p.defaultMinutes), total = mins * 60;
    const ui = stage(p);
    run = { started: Date.now(), timers: [], eased: false, stopped: false, end: () => finish(p, before, {}) };
    awake(true);
    const tips = [[20, 'Keep it connected — no gap at the top or bottom.'], [120, 'Tingling in the hands or face is normal. Let it be there.'], [300, 'If emotions come up, let them move through. You can always ease off.'],
      [480, 'Soften the out-breath — let it fall out by itself.'], [720, 'Stay with the circle of the breath.']];
    let easing = false;
    document.getElementById('bwEase').onclick = async () => {
      if (easing) return; easing = true; run.timers.forEach(clearTimeout);
      const ok = await easeOff(ui); if (!ok) return;
      ui.top.textContent = ''; ui.cue.innerHTML = '<div class="row wrap" style="justify-content:center"><button class="btn" id="bwMore">Carry on gently</button><button class="btn secondary" id="bwRest">Rest and finish</button></div>';
      document.getElementById('bwMore').onclick = () => { easing = false; loop(); };
      document.getElementById('bwRest').onclick = () => { integrate(); };
    };
    say('Breathe in and out through the mouth, in one continuous circle.');
    async function loop() {
      while (run && !easing && (Date.now() - run.started) / 1000 < total) {
        const el = (Date.now() - run.started) / 1000;
        ui.time.textContent = mmss(total - el); ui.top.textContent = 'Connected breathing';
        const tip = tips.filter(([t]) => el >= t).pop(); ui.cue.textContent = tip ? tip[1] : 'In and out, no pauses.';
        breath(ui, 'in', p.pace.in, 'In'); await wait(p.pace.in * 1000);
        if (!run || easing) return;
        breath(ui, 'out', p.pace.out, 'Out'); await wait(p.pace.out * 1000);
      }
      if (run && !easing) integrate();
    }
    async function integrate() {
      easing = true;   // stops the loop
      const T = p.integration * 60;
      ui.top.textContent = 'Rest'; document.getElementById('bwEase').style.display = 'none';
      ui.cue.textContent = 'Let your breath go back to normal, through the nose. Lie still. Nothing to do.'; ui.orb.textContent = 'Rest'; ui.orb.style.transform = 'scale(1)';
      say('Let your breathing return to normal. Lie still. Nothing to do.');
      const start = Date.now();
      while (run && (Date.now() - start) / 1000 < T) { ui.time.textContent = mmss(T - (Date.now() - start) / 1000); await wait(1000); }
      if (run) finish(p, before, {});
    }
    loop();
  }

  // ---------------------------------------------------------------- history
  function history() {
    const P = d.content.practices; const name = (id) => (P.find((p) => p.id === id) || {}).name || id;
    const holds = d.recent.filter((s) => s.practice === 'power' && s.rounds && s.rounds.length).reverse();
    let chart = '';
    if (holds.length >= 2) {
      const W = Math.min(640, ($app.clientWidth || 360) - 40), H = 150, L = 34, B = 20;
      const vals = holds.map((s) => Math.max(...s.rounds)); const hi = Math.max(...vals) * 1.15 || 60;
      const x = (i) => L + (i / (vals.length - 1)) * (W - L - 8), y = (v) => 8 + (1 - v / hi) * (H - 8 - B);
      chart = `<div class="card"><h2 style="margin-top:0">Best breath-hold</h2><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Best breath-hold per session">
        ${[0, hi / 2, hi].map((v) => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${mmss(v)}</text>`).join('')}
        <path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')}" fill="none" stroke="var(--moss)" stroke-width="2"/>
        ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="var(--moss)"><title>${new Date(holds[i].created_at).toLocaleDateString('en-GB')}: ${mmss(v)}</title></circle>`).join('')}</svg></div>`;
    }
    $app.innerHTML = `${back()}<h1>📈 My sessions</h1>${chart}
      ${d.recent.length ? `<div class="card">${d.recent.map((s) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(name(s.practice))}</b>
        <div class="small muted">${new Date(s.created_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${mmss(s.seconds)}${s.rounds && s.rounds.length ? ` · holds ${s.rounds.map(mmss).join(', ')}` : ''}${s.eased_off ? ' · eased off' : ''}</div>
        ${s.note ? `<div class="small">${esc(s.note)}</div>` : ''}</div><span class="small">${s.before ? HEAD[s.before] : '–'} → ${s.after ? HEAD[s.after] : '–'}</span></div>`).join('')}</div>`
    : '<div class="card"><p>No sessions yet.</p></div>'}`;
  }

  F.routes.breathwork = home;
  F.explore.tile({ href: '#breathwork', emoji: '🌬️', name: 'Breathwork', sub: 'Calm, focus & deep sessions', show: (s) => s.user && s.user.role === 'adult' });
})();
