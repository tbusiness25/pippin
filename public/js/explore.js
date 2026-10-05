/* Explore tab: self-care tools, reflections, quizzes, journeys, insights, the daily question. */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  let content = null;
  let cleanup = null;           // stops timers/sound when leaving a tool
  const getContent = async () => (content = content || await api('/api/tools/content'));
  window.addEventListener('hashchange', () => { if (cleanup) { cleanup(); cleanup = null; } });

  const back = (label = 'Explore') => `<a href="#explore" class="btn ghost" style="padding-left:0">‹ ${label}</a>`;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  async function logSession(kind, detail, seconds) {
    try {
      const r = await api('/api/tools/session', { body: { kind, detail, seconds } });
      F.showMessages(r.messages);
      if (r.energy?.started) F.afterEnergy(r.energy);
    } catch (e) { toast(e.message); }
  }

  // ---------- hub ----------
  async function hub() {
    F.setTab('explore');
    const [c, daily] = await Promise.all([getContent(), api('/api/tools/daily')]);
    const tiles = [
      ['breathe', '🫧', 'Breathe', '1–5 minute exercises'], ['sounds', '🎧', 'Sounds', 'Rain, brown noise, fire…'],
      ['focus', '⏳', 'Focus timer', 'Body-double with your sprig'], ['stretch', '🧘', 'Stretch', 'Short guided routines'],
      ['reflect', '✍️', 'Reflect', 'Prompts & free writing'], ['journeys', '🗺️', 'Journeys', 'Small steps over a few days'],
      ['quizzes', '📝', 'Check-ins', 'Mood, worry, wellbeing'], ['insights', '📈', 'Insights', 'What lifts your mood'],
    ];
    $app.innerHTML = `
      <div class="card"><h2>Today’s question</h2><div class="row" id="dq">${daily.options.map((o, i) =>
        `<button class="btn ${daily.answer === i ? '' : 'secondary'} grow" data-a="${i}">${esc(o)}</button>`).join('<span class="muted">or</span>')}</div>
        <p class="small muted" id="dqt" style="margin:.6em 0 0">${daily.answer == null ? 'No wrong answers.' : ''}</p></div>
      <div class="grid" style="margin-bottom:14px"><a class="tile" href="#habits"><span class="em">🔁</span><b>Habits</b><span class="small muted">Small, anchored, a few times a week</span></a>
        <a class="tile" href="#sober"><span class="em">🌱</span><b>Alcohol-free & quitting</b><span class="small muted">Count the days you keep</span></a>
        <a class="tile" href="#fitness"><span class="em">⌚</span><b>Watch</b><span class="small muted">Sleep, HRV, stress, steps, BP</span></a>
        <a class="tile" href="#food"><span class="em">🍽️</span><b>Food</b><span class="small muted">Diary & meal plans</span></a>
        <a class="tile" href="#workouts"><span class="em">🏋️</span><b>Workouts</b><span class="small muted">Log sets, save routines</span></a></div>
      <h2>Coach skills</h2><div class="tabs2">${[['urge', '🌊 Having an urge'], ['event', '🎉 Plan for an event'], ['stuck', '🧱 Can’t start'], ['hard', '🎯 Before a hard thing'], ['thought', '🧠 Thought check'], ['impulse', '⏸️ Pause before acting'], ['weekly', '🗓️ Weekly review'], ['people', '💛 Reach out']].map(([id, l]) => `<a class="chip" href="#coach/flow/${id}" style="text-decoration:none">${l}</a>`).join('')}</div>
      <div class="grid">${tiles.map(([id, em, name, sub]) => `<a class="tile" href="#explore/${id}"><span class="em">${em}</span><b>${name}</b><span class="small muted">${sub}</span></a>`).join('')}</div>
      <div style="height:14px"></div>
      <a class="tile" href="#journal" style="min-height:0;flex-direction:row;align-items:center"><span class="em">📖</span><div><b>${esc(F.state.pet.name)}’s adventures</b><div class="small muted">Every story so far</div></div></a>`;
    $app.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
      const r = await api('/api/tools/daily', { body: { answer: +b.dataset.a } });
      $app.querySelectorAll('[data-a]').forEach((x) => x.className = `btn ${x === b ? '' : 'secondary'} grow`);
      const total = r.tally[0] + r.tally[1];
      document.getElementById('dqt').textContent = total > 1 ? `${r.tally[+b.dataset.a]} of ${total} people here picked that today.` : 'Noted!';
    });
  }

  // ---------- breathing ----------
  async function breathe(id) {
    F.setTab('explore');
    const c = await getContent();
    const ex = c.breathing.find((b) => b.id === id);
    if (!ex) {
      $app.innerHTML = `${back()}<h1>Breathe</h1>${c.breathing.map((b) => `<a class="card row" href="#explore/breathe/${b.id}" style="text-decoration:none;color:inherit">
        <div class="grow"><b>${esc(b.name)}</b><div class="small muted">${esc(b.about)}</div><div class="small">${b.pattern.map(([k, s]) => `${k} ${s}`).join(' · ')}</div></div><span>›</span></a>`).join('')}`;
      return;
    }
    let mins = 1;
    $app.innerHTML = `<a href="#explore/breathe" class="btn ghost" style="padding-left:0">‹ Breathe</a><h1>${esc(ex.name)}</h1><p class="muted">${esc(ex.about)}</p>
      <div class="breath" id="orb">Ready</div>
      <div class="row" id="len" style="justify-content:center">${[1, 3, 5].map((m) => `<button class="chip ${m === 1 ? 'on' : ''}" data-m="${m}">${m} min</button>`).join('')}</div>
      <div style="height:12px"></div><button class="btn block" id="go">Start</button><p class="center small muted" id="left"></p>`;
    $app.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { mins = +b.dataset.m; $app.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); });
    const orb = document.getElementById('orb');
    let running = false, timer = null, stopIt = () => {};
    document.getElementById('go').onclick = () => {
      if (running) return stopIt(false);
      running = true; document.getElementById('go').textContent = 'Stop';
      const started = Date.now(), total = mins * 60;
      let i = 0;
      const step = () => {
        const elapsed = (Date.now() - started) / 1000;
        if (elapsed >= total) return stopIt(true);
        const [kind, secs] = ex.pattern[i % ex.pattern.length];
        orb.textContent = { in: 'Breathe in', out: 'Breathe out', hold: 'Hold' }[kind];
        orb.style.transitionDuration = `${secs}s`;
        if (kind === 'in') orb.style.transform = 'scale(1.35)';
        if (kind === 'out') orb.style.transform = 'scale(0.8)';
        document.getElementById('left').textContent = `${fmt(total - elapsed)} left`;
        i++; timer = setTimeout(step, secs * 1000);
      };
      stopIt = (done) => {
        clearTimeout(timer); running = false;
        const secs = Math.round((Date.now() - started) / 1000);
        orb.textContent = done ? 'Well done' : 'Paused'; orb.style.transform = 'scale(1)';
        const go = document.getElementById('go'); if (go) go.textContent = 'Start again';
        if (done) Sounds.chime();
        if (secs >= 30) logSession('breathing', ex.id, secs);
      };
      step();
      cleanup = () => clearTimeout(timer);
    };
  }

  // ---------- sounds ----------
  function sounds() {
    F.setTab('explore');
    let playing = null, endAt = null, tick = null;
    const S = Sounds.SCAPES;
    $app.innerHTML = `${back()}<h1>Sounds</h1><p class="muted">Made live on your phone — no downloads. Headphones recommended.</p>
      <div class="grid">${Object.entries(S).map(([id, s]) => `<button class="tile" data-s="${id}"><span class="em">${s.emoji}</span><b>${s.name}</b>${s.about ? `<span class="small muted">${s.about}</span>` : ''}</button>`).join('')}</div>
      <div class="card" style="margin-top:14px"><div class="field"><label for="vol">Volume</label><input type="range" id="vol" min="0" max="1" step="0.05" value="0.6"></div>
        <div class="row" id="tm">${[10, 30, 60, 0].map((m) => `<button class="chip ${m === 30 ? 'on' : ''}" data-t="${m}">${m ? `${m} min` : 'No timer'}</button>`).join('')}</div>
        <div class="bigtime" id="rem">—</div><button class="btn block warm" id="stop">Stop</button></div>`;
    let minutes = 30, started = null;
    const finish = () => {
      clearInterval(tick);
      if (playing && started) logSession('sound', playing, Math.round((Date.now() - started) / 1000));
      Sounds.stop(); playing = null; started = null;
      const rem = document.getElementById('rem'); if (rem) rem.textContent = '—';
      $app.querySelectorAll('[data-s]').forEach((x) => x.style.outline = '');
    };
    $app.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
      if (playing && started) logSession('sound', playing, Math.round((Date.now() - started) / 1000));
      playing = b.dataset.s; started = Date.now();
      Sounds.play(playing, +document.getElementById('vol').value);
      $app.querySelectorAll('[data-s]').forEach((x) => x.style.outline = x === b ? '3px solid var(--moss)' : '');
      endAt = minutes ? Date.now() + minutes * 60000 : null;
      clearInterval(tick);
      tick = setInterval(() => {
        const rem = document.getElementById('rem');
        if (!endAt) { if (rem) rem.textContent = '∞'; return; }
        const left = (endAt - Date.now()) / 1000;
        if (left <= 0) return finish();
        if (rem) rem.textContent = fmt(left);
      }, 500);
    });
    $app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
      minutes = +b.dataset.t; $app.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b));
      if (playing) endAt = minutes ? Date.now() + minutes * 60000 : null;
    });
    document.getElementById('vol').oninput = (e) => Sounds.volume(+e.target.value);
    document.getElementById('stop').onclick = finish;
    cleanup = finish;
  }

  // ---------- focus timer ----------
  function focus() {
    F.setTab('explore');
    const p = F.state.pet;
    let mins = 25, sound = '';
    $app.innerHTML = `${back()}<h1>Focus timer</h1><p class="muted">${esc(p.name)} will sit with you while you work. Pick one thing, then start.</p>
      <div class="field"><label for="what">What are you working on?</label><input id="what" maxlength="80" placeholder="Just one thing"></div>
      <div class="row wrap" id="mins">${[5, 10, 15, 25, 45].map((m) => `<button class="chip ${m === 25 ? 'on' : ''}" data-m="${m}">${m} min</button>`).join('')}</div>
      <div class="row wrap" style="margin-top:8px" id="snd">${[['', 'Silence'], ['brown', 'Brown noise'], ['rain', 'Rain']].map(([k, n]) => `<button class="chip ${k === '' ? 'on' : ''}" data-snd="${k}">${n}</button>`).join('')}</div>
      <div class="center" style="margin-top:10px">${window.sprigOf(p, { mood: 'calm', size: 130 })}</div>
      <div class="bigtime" id="clock">25:00</div><button class="btn block" id="go">Start</button>`;
    $app.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { mins = +b.dataset.m; document.getElementById('clock').textContent = fmt(mins * 60); $app.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); });
    $app.querySelectorAll('[data-snd]').forEach((b) => b.onclick = () => { sound = b.dataset.snd; $app.querySelectorAll('[data-snd]').forEach((x) => x.classList.toggle('on', x === b)); });
    let t = null, started = null, endAt = null;
    const stop = (done) => {
      clearInterval(t); t = null; Sounds.stop();
      const secs = started ? Math.round((Date.now() - started) / 1000) : 0; started = null;
      const go = document.getElementById('go'); if (go) go.textContent = 'Start';
      if (done) { Sounds.chime(); sheet(`<div class="center">${window.sprigOf(p, { mood: 'excited', size: 120 })}<h1>Focus session done!</h1>
        <p>${mins} minutes${document.getElementById('what')?.value ? ` on “${esc(document.getElementById('what').value)}”` : ''}. Stand up, stretch, drink some water.</p>
        <button class="btn block" id="ok">Nice</button></div>`, (sh, close) => sh.querySelector('#ok').onclick = close); }
      if (secs >= 60) logSession('focus', document.getElementById('what')?.value || `${mins} min`, secs);
    };
    document.getElementById('go').onclick = () => {
      if (t) return stop(false);
      started = Date.now(); endAt = started + mins * 60000;
      if (sound) Sounds.play(sound, 0.5);
      document.getElementById('go').textContent = 'Stop early';
      t = setInterval(() => {
        const left = (endAt - Date.now()) / 1000;
        if (left <= 0) { const c = document.getElementById('clock'); if (c) c.textContent = '0:00'; return stop(true); }
        const c = document.getElementById('clock'); if (c) c.textContent = fmt(left);
      }, 500);
    };
    cleanup = () => { if (t) stop(false); };
  }

  // ---------- stretches ----------
  async function stretch(id) {
    F.setTab('explore');
    const c = await getContent();
    const r = c.stretches.find((x) => x.id === id);
    if (!r) {
      $app.innerHTML = `${back()}<h1>Stretch</h1>${c.stretches.map((x) => `<a class="card row" href="#explore/stretch/${x.id}" style="text-decoration:none;color:inherit">
        <div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(x.about)} · ${Math.round(x.steps.reduce((a, s) => a + s[2], 0) / 60)} min</div></div><span>›</span></a>`).join('')}`;
      return;
    }
    let i = -1, t = null, left = 0; const started = Date.now();
    $app.innerHTML = `<a href="#explore/stretch" class="btn ghost" style="padding-left:0">‹ Stretch</a><h1>${esc(r.name)}</h1>
      <div class="progress"><div id="pg" style="width:0"></div></div>
      <div class="card center"><h2 id="sn">Ready?</h2><p id="sd" class="muted">${r.steps.length} moves. Go gently — nothing should hurt.</p><div class="bigtime" id="st"></div></div>
      <button class="btn block" id="go">Start</button>`;
    const next = () => {
      i++;
      if (i >= r.steps.length) { clearInterval(t); Sounds.chime(); document.getElementById('sn').textContent = 'All done 🌿'; document.getElementById('sd').textContent = 'Notice how your body feels now.';
        document.getElementById('st').textContent = ''; document.getElementById('go').classList.add('hidden'); logSession('stretch', r.id, Math.round((Date.now() - started) / 1000)); return; }
      const [name, how, secs] = r.steps[i]; left = secs;
      document.getElementById('sn').textContent = name; document.getElementById('sd').textContent = how;
      document.getElementById('pg').style.width = `${(i / r.steps.length) * 100}%`;
      document.getElementById('go').textContent = 'Skip';
    };
    document.getElementById('go').onclick = () => {
      if (!t) { next(); t = setInterval(() => { left--; const el = document.getElementById('st'); if (el) el.textContent = fmt(Math.max(0, left)); if (left <= 0) { Sounds.chime(); next(); } }, 1000); }
      else next();
    };
    cleanup = () => clearInterval(t);
  }

  // ---------- reflections ----------
  async function reflect() {
    F.setTab('explore');
    const [c, { reflections }] = await Promise.all([getContent(), api('/api/tools/reflections')]);
    let prompt = F.pick(c.prompts);
    $app.innerHTML = `${back()}<h1>Reflect</h1>
      <div class="card"><div class="row"><b class="grow" id="pr">${esc(prompt.text)}</b><button class="btn ghost" id="shuffle" aria-label="Another prompt">🔀</button></div>
        <textarea id="body" style="margin-top:10px" placeholder="Write as much or as little as you like"></textarea>
        <div class="row" style="margin-top:10px"><button class="btn ghost" id="free">Free write instead</button><span class="grow"></span><button class="btn" id="save">Save</button></div></div>
      <h2>Past entries</h2>${reflections.length ? reflections.map((r) => `<div class="card"><div class="small muted">${new Date(r.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${r.prompt ? ` · ${esc(r.prompt)}` : ''}</div>
        <p style="white-space:pre-wrap;margin:.4em 0 0">${esc(r.body)}</p><button class="btn ghost small" data-del="${r.id}">Delete</button></div>`).join('') : '<p class="muted">Nothing yet. These stay private to you.</p>'}`;
    document.getElementById('shuffle').onclick = () => { prompt = F.pick(c.prompts); document.getElementById('pr').textContent = prompt.text; };
    document.getElementById('free').onclick = () => { prompt = null; document.getElementById('pr').textContent = 'Free write'; };
    document.getElementById('save').onclick = async () => {
      try { const r = await api('/api/tools/reflections', { body: { prompt: prompt?.text, body: document.getElementById('body').value, tags: prompt ? [prompt.tag] : [] } });
        F.showMessages(r.messages); if (r.energy?.started) F.afterEnergy(r.energy); reflect(); }
      catch (e) { toast(e.message); }
    };
    $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (confirm('Delete this entry?')) { await api(`/api/tools/reflections/${b.dataset.del}`, { method: 'DELETE' }); reflect(); } });
  }

  // ---------- quizzes ----------
  function trend(results, max, higherIsBetter) {
    if (results.length < 2) return '';
    const W = 320, H = 90, pad = 8;
    const pts = results.map((r, i) => [pad + (i / (results.length - 1)) * (W - pad * 2), H - pad - (r.score / max) * (H - pad * 2)]);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:90px" role="img" aria-label="Scores over time">
      <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${higherIsBetter ? 'var(--moss)' : '#3f6fa0'}" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${higherIsBetter ? 'var(--moss)' : '#3f6fa0'}"/>`).join('')}</svg>`;
  }

  async function quizzes(id) {
    F.setTab('explore');
    const c = await getContent();
    if (!id) {
      const ck = await api('/api/tools/checks');
      const hist = {};
      await Promise.all(Object.keys(c.quizzes).map(async (k) => { hist[k] = await api(`/api/tools/quiz/${k}/history`); }));
      $app.innerHTML = `${back()}<h1>Check-ins</h1><p class="muted">Standard questionnaires GPs and therapists use. Doing the same one monthly builds a picture over time — useful to share. They’re screening tools, not a diagnosis.</p>
        ${Object.entries(c.quizzes).map(([k, q]) => { const h = hist[k]; const last = h.results.slice(-1)[0]; const due = ck.checks.find((x) => x.quiz === k);
          return `<div class="card"><a href="#explore/quizzes/${k}" class="row" style="text-decoration:none;color:inherit"><div class="grow"><b>${esc(q.name)}</b><div class="small muted">${esc(q.about)}</div>
            <div class="small" style="margin-top:4px">${last ? `Last: <b>${last.score}/${h.max}</b> (${esc(last.band)}) on ${new Date(last.at).toLocaleDateString('en-GB')}` : 'Not done yet'}${due ? (due.due ? ' · <b style="color:var(--terracotta)">due now</b>' : ` · next in ${28 - due.daysSince} days`) : ''}</div></div><span>›</span></a>
            ${trend(h.results, h.max, h.higherIsBetter)}
            <label class="row small" style="margin-top:6px"><input type="checkbox" data-monthly="${k}" ${ck.chosen.includes(k) ? 'checked' : ''} style="width:20px;height:20px"><span>Remind me monthly</span></label></div>`; }).join('')}
        <a class="btn secondary block" href="#report" style="text-align:center;text-decoration:none">📄 Share with my GP / therapist (PDF)</a>`;
      $app.querySelectorAll('[data-monthly]').forEach((b) => b.onchange = async () => {
        const chosen = [...$app.querySelectorAll('[data-monthly]:checked')].map((x) => x.dataset.monthly);
        await api('/api/tools/checks/settings', { body: { checks: chosen } }); toast('Saved');
      });
      return;
    }
    const { quiz } = await api(`/api/tools/quiz/${id}`);
    const answers = new Array(quiz.questions.length).fill(null);
    let qi = 0;
    const draw = () => {
      $app.innerHTML = `<a href="#explore/quizzes" class="btn ghost" style="padding-left:0">‹ Check-ins</a><h1>${esc(quiz.name)}</h1>
        <div class="progress"><div style="width:${(qi / quiz.questions.length) * 100}%"></div></div>
        <p class="muted">${esc(quiz.intro)}</p><h2>${esc(quiz.questions[qi])}</h2>
        ${quiz.options.map((o, i) => `<button class="opt ${answers[qi] === i ? 'on' : ''}" data-o="${i}">${esc(o)}</button>`).join('')}
        <div class="row" style="margin-top:10px">${qi ? '<button class="btn ghost" id="prev">‹ Back</button>' : ''}<span class="grow"></span><span class="small muted">${qi + 1} / ${quiz.questions.length}</span></div>`;
      $app.querySelectorAll('[data-o]').forEach((b) => b.onclick = async () => {
        answers[qi] = +b.dataset.o;
        if (qi < quiz.questions.length - 1) { qi++; return draw(); }
        const r = await api(`/api/tools/quiz/${id}`, { body: { answers } });
        $app.innerHTML = `<a href="#explore/quizzes" class="btn ghost" style="padding-left:0">‹ Check-ins</a><h1>${esc(quiz.name)}</h1>
          <div class="card center"><div class="bigtime">${r.score}<span class="small muted"> / ${r.max}</span></div><p>That’s in the <b>${esc(r.band)}</b> range.</p>
            <p class="small muted">This is a snapshot, not a diagnosis. If it’s been like this for a while, it’s worth mentioning to your GP.</p></div>
          ${r.support ? `<div class="card" style="background:#fbe9e4"><b>You don’t have to carry this alone.</b><br>Samaritans: <a href="tel:116123">116 123</a> (free, any time) · Text SHOUT to <a href="sms:85258">85258</a> · Emergency: <a href="tel:999">999</a>. Outside the UK, your local emergency number.</div>` : ''}
          ${r.history.length > 1 ? `<div class="card"><h3>Your scores over time</h3>${trend([...r.history].reverse(), r.max, quiz.higherIsBetter)}${r.history.map((h) => `<div class="row small"><span class="grow">${new Date(h.created_at).toLocaleDateString('en-GB')}</span><b>${h.score}</b></div>`).join('')}</div>` : ''}
          <a class="btn ghost block" href="#report">📄 Share with my GP / therapist</a>`;
      });
      document.getElementById('prev')?.addEventListener('click', () => { qi--; draw(); });
    };
    draw();
  }

  // ---------- journeys ----------
  async function journeys() {
    F.setTab('explore');
    const [c, { journeys: mine }] = await Promise.all([getContent(), api('/api/tools/journeys')]);
    const active = (id) => mine.find((j) => j.journey === id && !j.finished_at && !j.abandoned_at);
    const finished = (id) => mine.filter((j) => j.journey === id && j.finished_at).length;
    $app.innerHTML = `${back()}<h1>Journeys</h1><p class="muted">One small task a day for a few days. Each day’s task appears in Today. Missed a day? It just waits for you.</p>
      ${c.journeys.map((j) => { const a = active(j.id); return `<div class="card"><div class="row"><span style="font-size:1.8rem">${j.emoji}</span><div class="grow"><b>${esc(j.name)}</b>
        <div class="small muted">${esc(j.about)} · ${j.length} days${finished(j.id) ? ` · finished ${finished(j.id)}×` : ''}</div></div></div>
        ${a ? `<div class="progress"><div style="width:${(a.step / j.length) * 100}%"></div></div><div class="row"><span class="small grow">Day ${a.step} of ${j.length}</span><button class="btn ghost" data-stop="${a.id}">Stop</button></div>`
            : `<button class="btn secondary block" style="margin-top:10px" data-start="${j.id}">Start</button>`}</div>`; }).join('')}`;
    $app.querySelectorAll('[data-start]').forEach((b) => b.onclick = async () => { try { await api(`/api/tools/journeys/${b.dataset.start}/start`, { body: {} }); toast('Started — today’s task is on your home screen'); await F.refresh(); journeys(); } catch (e) { toast(e.message); } });
    $app.querySelectorAll('[data-stop]').forEach((b) => b.onclick = async () => { if (confirm('Stop this journey? You can start it again any time.')) { await api(`/api/tools/journeys/${b.dataset.stop}/stop`, { body: {} }); journeys(); } });
  }

  // ---------- insights ----------
  async function insights() {
    F.setTab('explore');
    let days = 30;
    const draw = async () => {
      const d = await api(`/api/tools/insights?days=${days}`);
      const W = 340, H = 150, pad = 18;
      const pts = d.mood.map((m, i) => [pad + (i / Math.max(1, d.mood.length - 1)) * (W - pad * 2), H - pad - ((m.mood - 1) / 4) * (H - pad * 2)]);
      const maxCat = Math.max(1, ...d.categories.map((c) => c.n));
      const maxEmo = Math.max(1, ...d.emotions.map((e) => e.n));
      $app.innerHTML = `${back()}<h1>Insights</h1>
        <div class="row" style="margin-bottom:12px">${[7, 30, 90].map((n) => `<button class="chip ${n === days ? 'on' : ''}" data-d="${n}">${n} days</button>`).join('')}</div>
        <div class="card"><h2>Mood</h2>${d.mood.length > 1 ? `<svg class="chart" viewBox="0 0 ${W} ${H}">
          ${[1, 3, 5].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${H - pad - ((v - 1) / 4) * (H - pad * 2)}" y2="${H - pad - ((v - 1) / 4) * (H - pad * 2)}" stroke="var(--line)"/><text x="0" y="${H - pad - ((v - 1) / 4) * (H - pad * 2) + 4}" font-size="10" fill="var(--muted)">${['😞', '', '😐', '', '😄'][v - 1]}</text>`).join('')}
          <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--moss)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
          ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--moss)"/>`).join('')}</svg>` : '<p class="muted">Check in on a few days and your mood line appears here.</p>'}</div>
        ${d.lifts.length ? `<div class="card"><h2>What seems to help</h2><p class="small muted">Your average mood on days you did something vs days you didn’t. Patterns, not proof.</p>
          ${d.lifts.slice(0, 6).map((l) => `<div class="row" style="padding:6px 0"><span class="grow">${esc(l.what)}</span><b style="color:${l.diff >= 0 ? 'var(--moss-deep)' : 'var(--terracotta)'}">${l.diff >= 0 ? '+' : ''}${l.diff}</b></div>`).join('')}</div>` : ''}
        <div class="card"><h2>Feelings you’ve named</h2>${d.emotions.length ? d.emotions.map((e) => `<div class="row small" style="margin:6px 0"><span style="width:90px">${esc(e.e)}</span><div class="grow"><div class="bar" style="width:${(e.n / maxEmo) * 100}%"></div></div><span>${e.n}</span></div>`).join('') : '<p class="muted small">Tap feelings during check-ins to see them here.</p>'}</div>
        <div class="card"><h2>What you’ve looked after</h2>${d.categories.length ? d.categories.map((c) => `<div class="row small" style="margin:6px 0"><span style="width:90px">${F.CAT_EMOJI[c.category] || '🌿'} ${esc(c.category)}</span><div class="grow"><div class="bar" style="width:${(c.n / maxCat) * 100}%;background:var(--sun)"></div></div><span>${c.n}</span></div>`).join('') : '<p class="muted small">Nothing yet.</p>'}</div>
        <div class="card"><h2>All time</h2><div class="grid">${[['✅', d.totals.goals, 'goals done'], ['☀️', d.totals.checkins, 'check-ins'], ['🫧', d.totals.tools, 'tool sessions'], ['⏳', Math.round(d.totals.focus_seconds / 60), 'focus minutes'], ['✍️', d.totals.reflections, 'reflections']].map(([e, n, l]) => `<div class="tile" style="min-height:0"><span>${e}</span><b style="font-size:1.4rem">${n}</b><span class="small muted">${l}</span></div>`).join('')}</div></div>`;
      $app.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { days = +b.dataset.d; draw(); });
    };
    draw();
  }

  F.routes.explore = (sub = '') => {
    const [page, arg] = sub.split('/');
    return ({ breathe, sounds, focus, stretch, reflect, quizzes, journeys, insights }[page] || hub)(arg);
  };
})();
