/* ⌨️ Typing: short drills that build speed and accuracy, and "Explain it" where you type your own thinking. */
(function () {
  const esc = F.esc;
  const K = () => F.kids;
  const date = (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  async function render(el, rest) {
    const tab = (rest || 'practice').split('/')[0];
    el.innerHTML = `<div class="kids kt">${K().header('Typing', '⌨️')}
      <div class="kj-tabs"><a class="kj-tab ${tab === 'practice' ? 'on' : ''}" href="#k/typing/practice">⌨️ Practice</a><a class="kj-tab ${tab === 'explain' ? 'on' : ''}" href="#k/typing/explain">✍️ Explain it</a></div>
      <div id="ktBody"><p class="muted center">Loading…</p></div></div>`;
    const body = el.querySelector('#ktBody');
    if (K().viewingChild) { body.innerHTML = '<div class="card"><p>Only the child types here, from their own app.</p></div>'; return; }
    let d; try { d = await K().api('/typing'); } catch (e) { body.innerHTML = `<p>${esc(e.message)}</p>`; return; }
    if (tab === 'explain') return explain(body, d);
    return practice(body, d);
  }

  const lessonName = (d, id) => (d.lessons.find((l) => l.id === id) || { name: id }).name;

  function practice(body, d) {
    const best = {};
    for (const r of d.results) if (r.kind === 'drill' && r.accuracy >= 90 && (!best[r.lesson] || r.wpm > best[r.lesson])) best[r.lesson] = Math.round(r.wpm);
    const drills = d.results.filter((r) => r.kind === 'drill').slice(0, 8);
    body.innerHTML = `<p>Type the words exactly as they show. Get every letter right first, speed comes after.</p>
      <div class="kt-list">${d.lessons.map((l) => `<button class="kt-lesson" data-lesson="${l.id}"><b>${esc(l.name)}</b>
        <span class="small muted">${best[l.id] ? `Best ${best[l.id]} words a minute` : 'Not tried yet'}</span></button>`).join('')}</div>
      <h2 class="kj-h">Recent goes</h2>${drills.map((r) => `<div class="small kt-recent">${esc(lessonName(d, r.lesson))} · ${Math.round(r.wpm)} wpm · ${Math.round(r.accuracy)}% · ${date(r.created_at)}</div>`).join('') || '<p class="muted small">No goes yet.</p>'}`;
    body.querySelectorAll('[data-lesson]').forEach((b) => { b.onclick = () => drill(body, d, d.lessons.find((l) => l.id === b.dataset.lesson)); });
  }

  function drill(body, d, lesson) {
    const text = lesson.text;
    body.innerHTML = `<h2 style="margin-top:0">${esc(lesson.name)}</h2>
      <div class="kt-target" id="ktTarget"></div>
      <input id="ktIn" class="kt-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Start typing here…" aria-label="Type the words above">
      <div class="row" style="margin-top:10px"><span class="small muted" id="ktStat">Start typing when you’re ready</span>
        <button class="btn ghost" id="ktBack" style="margin-left:auto">Back</button></div>`;
    const target = body.querySelector('#ktTarget'), input = body.querySelector('#ktIn'), stat = body.querySelector('#ktStat');
    const chars = [...text];
    let started = 0, done = false;
    const paint = () => {
      const v = input.value;
      target.innerHTML = chars.map((ch, i) => `<span class="${i < v.length ? (v[i] === ch ? 'ok' : 'bad') : (i === v.length ? 'cur' : '')}">${esc(ch)}</span>`).join('');
    };
    paint();
    input.oninput = async () => {
      if (done) return;
      if (!started && input.value) started = Date.now();
      paint();
      if (started && input.value.length >= 3) {
        const mins = (Date.now() - started) / 60000;
        stat.textContent = `${Math.round((input.value.length / 5) / Math.max(mins, 0.01))} words a minute so far`;
      }
      if (input.value.length < text.length) return;
      done = true; input.disabled = true;
      const typed = input.value.slice(0, text.length);
      const seconds = Math.max(1, (Date.now() - started) / 1000);
      const accuracy = (chars.filter((ch, i) => typed[i] === ch).length / chars.length) * 100;
      const wpm = (chars.length / 5) / (seconds / 60);
      try { await K().api('/typing/drill', { body: { lesson: lesson.id, wpm, accuracy, seconds: Math.round(seconds) } }); }
      catch (e) { F.toast(e.message); }
      body.innerHTML = `<div class="card kid-card center"><div style="font-size:2.4rem">${accuracy >= 95 ? '🌟' : '👏'}</div>
        <h2>${Math.round(wpm)} words a minute</h2><p>${Math.round(accuracy)}% of the letters right.</p>
        <button class="btn block" id="ktAgain">Go again</button>
        <button class="btn secondary block" id="ktOther" style="margin-top:8px">Other lessons</button></div>`;
      body.querySelector('#ktAgain').onclick = () => drill(body, d, lesson);
      body.querySelector('#ktOther').onclick = () => practice(body, d);
    };
    body.querySelector('#ktBack').onclick = () => practice(body, d);
    setTimeout(() => input.focus(), 50);
  }

  function explain(body, d) {
    const mine = d.results.filter((r) => r.kind === 'explain');
    let prompt = d.prompts[0];
    body.innerHTML = `<p>Pick a question, then type what you think. There are no wrong answers. It’s to show how your brain works, step by step.</p>
      <div class="kt-prompts">${d.prompts.map((p, i) => `<button class="kj-pill ${i === 0 ? 'on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      <textarea id="ktEx" class="kt-ex" maxlength="2000" rows="8" placeholder="Type your thinking here…" aria-label="Your explanation"></textarea>
      <div class="row"><span class="small muted" id="ktExN">0 / 2000</span><button class="btn" id="ktSave" style="margin-left:auto">Save</button></div>
      <h2 class="kj-h">Your explanations</h2>${mine.slice(0, 10).map((r) => `<div class="kt-old"><div class="small muted">${esc(r.lesson)} · ${date(r.created_at)}</div><p>${esc(r.body)}</p></div>`).join('') || '<p class="muted small">None yet.</p>'}`;
    const ta = body.querySelector('#ktEx');
    body.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => {
      prompt = b.dataset.p; body.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b));
    }; });
    ta.oninput = () => { body.querySelector('#ktExN').textContent = `${ta.value.length} / 2000`; };
    body.querySelector('#ktSave').onclick = async () => {
      const text = ta.value.trim(); if (!text) return F.toast('Type something first');
      try { await K().api('/typing/explain', { body: { prompt, text } }); F.toast('Saved ✍️'); explain(body, await K().api('/typing')); }
      catch (e) { F.toast(e.message); }
    };
  }

  F.kids.register({ id: 'typing', emoji: '⌨️', name: 'Typing', colour: '#5b8fb9', order: 42, render });
})();
