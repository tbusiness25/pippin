/* Kids → Books: a bookshelf where covers stand on wooden shelves, colour-coded AND labelled in words —
 * GREEN ✓ finished · BLUE 📖 reading now · RED ● not read yet. A book's page lets them start it, finish it and
 * do a "Book Chat": a score out of 7, what they liked / didn't like and four fun questions, typed or spoken
 * (voice notes are kept so they can hear themselves later). Then Book Buddy says something back.
 * Routes: #k/books · #k/books/<id> */
(function () {
  const { esc, toast } = F;
  const STATUS_WORD = { finished: 'Finished', reading: 'Reading', not_read: 'Not read yet' };
  const STATUS_ICON = { finished: '✓', reading: '📖', not_read: '●' };
  const SCORE_WORDS = ['', 'Not for me', 'It was OK', 'Pretty good', 'Good', 'Really good', 'Brilliant!', 'THE BEST EVER!'];
  const FILTERS = [['all', 'All'], ['reading', '📖 Reading'], ['finished', '✓ Finished'], ['not_read', 'Not read yet']];
  const st = { items: [], stats: null, filter: 'all', group: null, query: '' };
  let current = null, chat = null, stopMic = null;

  const withChild = (u) => (F.kids.viewingChild && u ? `${u}${u.includes('?') ? '&' : '?'}child=${encodeURIComponent(F.kids.viewingChild)}` : u);
  const todayIso = () => new Date().toLocaleDateString('en-CA');
  const niceDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const hue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
  const fake = (b, cls) => `<div class="${cls} bk-fake" style="--h:${hue(b.title || '')}"><span class="bk-fake-title">${esc(b.title)}</span>${b.author ? `<span class="bk-fake-author">${esc(b.author)}</span>` : ''}</div>`;
  const cover = (b, cls) => (b.cover ? `<img class="${cls}" alt="" loading="lazy" decoding="async" src="${esc(withChild(b.cover))}" data-fake="${esc(fake(b, cls))}">` : fake(b, cls));
  const fixCovers = (el) => el.querySelectorAll('img[data-fake]').forEach((i) => i.addEventListener('error', () => { i.outerHTML = i.dataset.fake; }, { once: true }));
  const badge = (s) => `<span class="bk-badge is-${s}"><i aria-hidden="true">${STATUS_ICON[s]}</i> ${s === 'not_read' ? 'Not yet' : STATUS_WORD[s]}</span>`;
  const seriesLine = (b) => (!b.series ? '' : b.series_num ? `${b.series} · Book ${b.series_num}` : b.kind === 'activity' ? `${b.series} · activity book` : b.kind === 'special' ? `${b.series} · special` : b.series);
  const stopAll = () => { if (stopMic) stopMic(); try { window.speechSynthesis && speechSynthesis.cancel(); } catch (_) {} };

  // ---------- the shelf ----------
  async function shelf(el) {
    stopAll();
    const d = await F.kids.api('/books');
    st.items = d.items; st.stats = d.stats;
    el.innerHTML = `<div class="kids books">${F.kids.header('My books', '📚')}
      <div id="bk-header" class="bk-header"></div>
      <div class="bk-legend" aria-label="What the colours mean">
        <span class="bk-key is-finished"><i aria-hidden="true">✓</i> Green = finished</span>
        <span class="bk-key is-reading"><i aria-hidden="true">📖</i> Blue = reading now</span>
        <span class="bk-key is-not_read"><i aria-hidden="true">●</i> Red = not read yet</span></div>
      <input type="search" id="bk-search" maxlength="60" placeholder="Find a book or author…" aria-label="Search books" autocomplete="off" value="${esc(st.query)}">
      <div id="bk-filters" class="bk-chips" role="group" aria-label="Show"></div>
      <div id="bk-groups" class="bk-chips bk-chips-groups" role="group" aria-label="Series"></div>
      <div id="bk-shelves" class="bk-shelves"></div>
      <button class="btn secondary block bk-add-open" id="bk-add">＋ Add a book that isn’t here</button></div>`;
    renderHeader(el); renderFilters(el); renderShelves(el);
    let t = null;
    el.querySelector('#bk-search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { st.query = e.target.value.trim(); renderShelves(el); }, 200); });
    el.querySelector('#bk-add').onclick = addBook;
  }

  function renderHeader(el) {
    const s = st.stats, h = el.querySelector('#bk-header');
    if (!s) return;
    const left = s.shelf_size - s.on_current_shelf;
    h.innerHTML = `<div class="bk-stats">${[[s.finished, s.finished === 1 ? 'book finished' : 'books finished'], [s.this_year, `in ${s.year}`], [s.reading, 'reading now']]
      .map(([n, l]) => `<div class="bk-stat"><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <div class="bk-myshelf"><div class="bk-myshelf-title">${s.shelves_full ? `🏆 ${s.shelves_full} ${s.shelves_full === 1 ? 'shelf' : 'shelves'} filled! Now filling shelf ${s.shelves_full + 1}` : 'Fill up your first shelf!'}</div>
        <div class="bk-myshelf-row" role="img" aria-label="${s.on_current_shelf} of ${s.shelf_size} spaces filled on this shelf">${Array.from({ length: s.shelf_size }, (_, i) => `<span class="bk-spine${i < s.on_current_shelf ? ' is-full' : ''}" style="--h:${(i * 47 + 120) % 360}"></span>`).join('')}</div>
        <div class="bk-myshelf-sub">${s.on_current_shelf} of ${s.shelf_size} — ${left} more ${left === 1 ? 'book' : 'books'} to fill this shelf</div>
        ${s.milestone || s.next_milestone ? `<div class="bk-milestone">${s.milestone ? `<span class="bk-medal">🏅 ${esc(s.milestone)}</span>` : ''}${s.next_milestone ? `<span class="bk-next">Next: “${esc(s.next_milestone.name)}” at ${s.next_milestone.at} books</span>` : ''}</div>` : ''}</div>`;
  }

  function renderFilters(el) {
    const count = (k) => (k === 'all' ? st.items.length : st.items.filter((b) => b.status === k).length);
    const f = el.querySelector('#bk-filters');
    f.innerHTML = FILTERS.map(([k, l]) => `<button class="bk-chip${k !== 'all' ? ` is-${k}` : ''}" data-f="${k}" aria-pressed="${st.filter === k}">${esc(l)} (${count(k)})</button>`).join('');
    f.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { st.filter = b.dataset.f; renderFilters(el); renderShelves(el); });
    const groups = [...new Set(st.items.map((b) => b.shelf_group))];
    const g = el.querySelector('#bk-groups');
    g.innerHTML = [null, ...groups].map((n, i) => `<button class="bk-chip" data-g="${i}" aria-pressed="${st.group === n}">${esc(n || 'Every shelf')}</button>`).join('');
    g.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { st.group = [null, ...groups][+b.dataset.g]; renderFilters(el); renderShelves(el); });
  }

  function matches(b) {
    if (st.filter !== 'all' && b.status !== st.filter) return false;
    if (st.group && b.shelf_group !== st.group) return false;
    if (st.query) { const q = st.query.toLowerCase(); if (![b.title, b.author, b.series].some((x) => (x || '').toLowerCase().includes(q))) return false; }
    return true;
  }

  function renderShelves(el) {
    const wrap = el.querySelector('#bk-shelves');
    const shown = st.items.filter(matches);
    if (!st.items.length) { wrap.innerHTML = '<p class="muted center">Your bookshelf is being built — check back soon!</p>'; return; }
    if (!shown.length) {
      wrap.innerHTML = `<p class="muted center">${st.query ? 'No books called that. Try another word — or add it below!'
        : st.filter === 'reading' ? 'Nothing on the go right now. Pick a book and tap “I’ve started it!”'
          : st.filter === 'finished' ? 'No finished books here yet — your first one will go green!' : 'Nothing here.'}</p>`;
      return;
    }
    const byGroup = new Map();
    shown.forEach((b) => { if (!byGroup.has(b.shelf_group)) byGroup.set(b.shelf_group, []); byGroup.get(b.shelf_group).push(b); });
    wrap.innerHTML = [...byGroup].map(([name, list]) => {
      const all = st.items.filter((b) => b.shelf_group === name);
      return `<section class="bk-case"><div class="bk-case-head"><h2>${esc(name)}</h2><span class="bk-case-count">${all.filter((b) => b.status === 'finished').length} of ${all.length} read</span></div>
        <div class="bk-shelf">${list.map((b) => `<a class="bk-book is-${b.status}" href="#k/books/${b.id}" aria-label="${esc(`${b.title}${b.author ? ` by ${b.author}` : ''} — ${STATUS_WORD[b.status]}`)}">
          ${cover(b, 'bk-cover')}${badge(b.status)}${b.series_num ? `<span class="bk-num">#${b.series_num}</span>` : ''}${b.requested_at && b.status === 'not_read' ? '<span class="bk-asked-badge" title="You asked for this one">🛒</span>' : ''}${b.score ? `<span class="bk-score">★${b.score}</span>` : ''}</a>`).join('')}</div></section>`;
    }).join('');
    fixCovers(wrap);
  }

  function addBook() {
    F.sheet(`<h1>Add a book</h1><p class="muted">Reading something that isn’t on your shelves? Add it here.</p>
      <div class="field"><input id="bt" maxlength="200" placeholder="Book title" aria-label="Book title"></div>
      <div class="field"><input id="ba" maxlength="120" placeholder="Who wrote it? (if you know)" aria-label="Author"></div>
      <button class="btn block big" id="ok">＋ Add it to my shelf</button>`, (sh, close) => {
      sh.querySelector('#ok').onclick = async () => {
        const title = sh.querySelector('#bt').value.trim();
        if (title.length < 2) { sh.querySelector('#bt').focus(); return; }
        try { const d = await F.kids.api('/books', { body: { title, author: sh.querySelector('#ba').value.trim() } }); close(); F.go(`#k/books/${d.id}`); }
        catch (e) { toast(e.message); }
      };
    });
  }

  // ---------- a book's page ----------
  async function openBook(el, id) {
    stopAll();
    el.innerHTML = `<div class="kids books">${F.kids.header('Book', '📖', '#k/books')}<div class="card kid-card bk-page" id="bk-body"><p class="muted center">Opening…</p></div></div>`;
    current = await F.kids.api(`/books/${id}`);
    current.el = el.querySelector('#bk-body');
    renderBook();
  }
  const body = () => current.el;

  function playButton(voiceId, label = 'Hear me') {
    return `<button class="bk-play" data-play="${esc(voiceId)}" data-label="${esc(label)}">▶ ${esc(label)}</button>`;
  }
  function wirePlay(root) {
    root.querySelectorAll('[data-play]').forEach((b) => {
      let audio = null;
      b.onclick = () => {
        if (audio && !audio.paused) { audio.pause(); b.textContent = `▶ ${b.dataset.label}`; return; }
        audio = audio || new Audio(withChild(`/api/kids/books/voice/${encodeURIComponent(b.dataset.play)}`));
        audio.onended = () => { b.textContent = `▶ ${b.dataset.label}`; };
        audio.play().then(() => { b.textContent = '⏸ Stop'; }).catch(() => { b.textContent = 'Can’t play that'; });
      };
    });
  }

  function starsLine(n) {
    return `<div class="bk-stars-line" aria-label="${n} out of 7">${Array.from({ length: 7 }, (_, i) => `<span class="${i < n ? 'on' : 'off'}">★</span>`).join('')}<em> ${n}/7 — ${esc(SCORE_WORDS[n])}</em></div>`;
  }
  function reviewHtml(r) {
    const qa = (q, text, voice) => (!text && !voice ? '' : `<div class="bk-qa"><div class="bk-q">${esc(q)}</div>${text ? `<div class="bk-a">${esc(text)}</div>` : ''}${voice ? playButton(voice) : ''}</div>`);
    return `<div class="bk-review"><h3>My Book Chat</h3>${r.score ? starsLine(r.score) : ''}
      ${qa('What I liked', r.liked, r.liked_voice)}${qa('What I didn’t like', r.disliked, r.disliked_voice)}
      ${(r.answers || []).map((a) => qa(a.question, a.text, a.voice_id)).join('')}
      ${r.buddy_reply ? `<div class="bk-buddy"><div class="bk-buddy-who">💬 Book Buddy says</div><div class="bk-buddy-text">${esc(r.buddy_reply)}</div></div>` : ''}</div>`;
  }

  function renderBook() {
    stopAll();
    const { book: b, review } = current;
    let actions;
    const ask = b.owned === true ? '' : b.requested_at
      ? `<p class="bk-asked">🛒 You asked a grown-up for this one ✓</p><button class="btn ghost" data-a="unask">Never mind — I don’t need it</button>`
      : '<button class="bk-big is-ask" data-a="ask">🛒 I haven’t got this one — can we get it?</button>';
    if (b.status === 'not_read') actions = `<button class="bk-big is-reading" data-a="read">📖 I’ve started it!</button><button class="bk-big is-finished" data-a="finish">🎉 I finished it!</button>${ask}`;
    else if (b.status === 'reading') {
      actions = `${b.started_on ? `<p class="bk-when">You started it on ${esc(niceDate(b.started_on))}.</p>` : ''}<button class="bk-big is-finished" data-a="finish">🎉 I finished it!</button>
        <button class="btn ghost" data-a="unread">Oops — I haven’t started it yet</button>`;
    } else {
      actions = `<label class="bk-date-row"><span>🎉 Finished on</span><input type="date" id="bk-fin" max="${todayIso()}" value="${esc(b.finished_on || todayIso())}"></label>
        <button class="bk-big is-chat" data-a="chat">${review ? '✏️ Change my Book Chat' : '💬 Tell Buddy about it!'}</button>
        <button class="btn ghost" data-a="read">I’m reading it again</button>`;
    }
    body().innerHTML = `<div class="bk-top">${cover(b, `bk-big-cover is-${b.status}`)}<div class="bk-info"><h2 class="bk-title">${esc(b.title)}</h2>
      ${b.author ? `<div class="bk-author">by ${esc(b.author)}</div>` : ''}${seriesLine(b) ? `<div class="bk-series">${esc(seriesLine(b))}</div>` : ''}${badge(b.status)}</div></div>
      <div class="bk-actions">${actions}</div>${review ? reviewHtml(review) : ''}`;
    fixCovers(body()); wirePlay(body());
    const on = (a, f) => { const x = body().querySelector(`[data-a="${a}"]`); if (x) x.onclick = f; };
    on('read', () => setStatus('reading'));
    const askFor = async (cancel) => {
      try {
        await F.kids.api(`/books/${b.id}/request`, { body: { cancel } });
        b.requested_at = cancel ? null : new Date().toISOString();
        const hit = (st.items || []).find((x) => x.id === b.id); if (hit) hit.requested_at = b.requested_at;
        F.toast(cancel ? 'OK — taken off the list' : 'Asked! A grown-up will see it on their list 📚');
        renderBook();
      } catch (e) { F.toast(e.message); }
    };
    on('ask', () => askFor(false));
    on('unask', () => askFor(true));
    on('unread', () => setStatus('not_read'));
    on('finish', finishFlow);
    on('chat', startChat);
    const fin = body().querySelector('#bk-fin');
    if (fin) fin.onchange = () => { if (fin.value) setStatus('finished', fin.value, true); };
  }

  async function setStatus(status, date, quiet) {
    try {
      const d = await F.kids.api(`/books/${current.book.id}/status`, { body: { status, date: date || undefined } });
      Object.assign(current.book, d.book);
      F.kids.celebrate(d);
      if (!quiet || status !== 'finished') renderBook();
      return true;
    } catch (e) { toast(e.message || 'Oops — that didn’t save. Try again?'); return false; }
  }

  function finishFlow() {
    const b = current.book;
    body().innerHTML = `<div class="bk-celebrate"><div class="bk-confetti">🎉📚🎉</div><h2>You finished it!</h2><p>${esc(b.title)}</p>
      <label class="bk-date-row"><span>When did you finish?</span><input type="date" id="bk-when" max="${todayIso()}" value="${todayIso()}"></label>
      <button class="bk-big is-finished" id="put">✓ Put it on my shelf</button><button class="btn ghost" id="back">Back</button></div>`;
    body().querySelector('#back').onclick = renderBook;
    body().querySelector('#put').onclick = async () => {
      if (!(await setStatus('finished', body().querySelector('#bk-when').value || todayIso(), true))) return;
      if (current.review) return renderBook();      // a re-read — the page shows the old Book Chat
      body().innerHTML = `<div class="bk-celebrate"><div class="bk-confetti">✅</div><h2>It’s on your shelf — and it’s green!</h2>
        <p>Want to do a Book Chat? Give it a score and tell Buddy what you thought. You can type or talk.</p>
        <button class="bk-big is-chat" id="yes">💬 Yes, let’s chat!</button><button class="btn ghost" id="later">Maybe later</button></div>`;
      body().querySelector('#yes').onclick = startChat;
      body().querySelector('#later').onclick = renderBook;
    };
  }

  // ---------- Book Chat ----------
  async function startChat() {
    const b = current.book, r = current.review;
    const questions = (await F.kids.api(`/books/${b.id}/questions`).catch(() => ({ questions: [] }))).questions;
    if (r && r.answers && r.answers.length) {      // editing keeps the questions already answered
      const asked = r.answers.map((a) => ({ slug: a.slug, question: a.question }));
      questions.forEach((x) => { if (asked.length < 4 && !asked.some((a) => a.slug === x.slug)) asked.push(x); });
      questions.splice(0, questions.length, ...asked.slice(0, 4));
    }
    const answers = { liked: { text: r?.liked || '', voice_id: r?.liked_voice || null }, disliked: { text: r?.disliked || '', voice_id: r?.disliked_voice || null } };
    questions.forEach((x) => { const p = r && (r.answers || []).find((a) => a.slug === x.slug); answers[`q:${x.slug}`] = { text: p?.text || '', voice_id: p?.voice_id || null }; });
    chat = { i: 0, score: r?.score || 0, questions, spin: 0, answers, steps: ['score', 'liked', 'disliked', ...questions.map((x) => `q:${x.slug}`), 'done'] };
    renderStep();
  }

  function stepQuestion(step) {
    if (step === 'liked') return { q: 'What did you like about it?', hint: 'Anything at all — a bit, a picture, a character…' };
    if (step === 'disliked') return { q: 'Was there anything you didn’t like?', hint: '“Nothing!” is a fine answer too.' };
    const x = chat.questions.find((y) => y.slug === step.slice(2));
    return { q: x ? x.question : '', hint: 'You can skip this one if you like.' };
  }

  function renderStep() {
    stopAll();
    const step = chat.steps[chat.i], w = body();
    const total = chat.steps.length - 1;
    const head = `<div class="bk-chat-head">💬 Book Chat · ${esc(current.book.title)}</div>${step !== 'done' ? `<div class="bk-progress" aria-label="Question ${chat.i + 1} of ${total}">${Array.from({ length: total }, (_, n) => `<span class="${n < chat.i ? 'done' : n === chat.i ? 'now' : ''}"></span>`).join('')}</div>` : ''}`;
    window.scrollTo(0, 0);
    if (step === 'score') {
      w.innerHTML = `${head}<h2 class="bk-chat-q">How many stars out of 7?</h2>
        <div class="bk-star-pick">${Array.from({ length: 7 }, (_, i) => `<button class="bk-star${i < chat.score ? ' on' : ''}" data-n="${i + 1}" aria-label="${i + 1} out of 7" aria-pressed="${i + 1 === chat.score}">★</button>`).join('')}</div>
        <div class="bk-star-word" id="sw">${chat.score ? `${chat.score} out of 7 — ${esc(SCORE_WORDS[chat.score])}` : 'Tap a star'}</div>
        <div class="bk-chat-nav"><button class="bk-big is-chat" id="next" ${chat.score ? '' : 'disabled'}>Next →</button></div>`;
      w.querySelectorAll('.bk-star').forEach((s) => s.onclick = () => {
        chat.score = +s.dataset.n;
        w.querySelectorAll('.bk-star').forEach((x, k) => { x.classList.toggle('on', k < chat.score); x.setAttribute('aria-pressed', String(k + 1 === chat.score)); });
        w.querySelector('#sw').textContent = `${chat.score} out of 7 — ${SCORE_WORDS[chat.score]}`;
        w.querySelector('#next').disabled = false;
      });
      w.querySelector('#next').onclick = () => { chat.i++; renderStep(); };
      return;
    }
    if (step === 'done') {
      const tmp = { score: chat.score, liked: chat.answers.liked.text, liked_voice: chat.answers.liked.voice_id,
        disliked: chat.answers.disliked.text, disliked_voice: chat.answers.disliked.voice_id,
        answers: chat.questions.map((x) => ({ question: x.question, text: chat.answers[`q:${x.slug}`].text, voice_id: chat.answers[`q:${x.slug}`].voice_id })) };
      w.innerHTML = `${head}<h2 class="bk-chat-q">All done! Ready to save it?</h2>${reviewHtml(tmp)}
        <div class="bk-chat-nav"><button class="btn ghost" id="back">← Back</button><button class="bk-big is-finished" id="save">✓ Save my Book Chat</button></div>`;
      wirePlay(w);
      w.querySelector('#back').onclick = () => { chat.i--; renderStep(); };
      w.querySelector('#save').onclick = submitChat;
      return;
    }
    const { q, hint } = stepQuestion(step);
    const a = chat.answers[step];
    w.innerHTML = `${head}<h2 class="bk-chat-q">${esc(q)}</h2><p class="bk-chat-hint">${esc(hint)}</p>
      <textarea class="bk-answer" rows="4" maxlength="1000" placeholder="Type here… or tap the microphone and say it!" aria-label="${esc(q)}">${esc(a.text)}</textarea>
      <div class="bk-mic-row"><button class="bk-mic" id="mic">🎤 Say it</button><span class="bk-mic-status" id="ms"></span><span id="vs">${a.voice_id ? playButton(a.voice_id, 'My voice note') : ''}</span></div>
      ${step.startsWith('q:') ? '<button class="btn ghost bk-spin" id="spin">🔀 A different question</button>' : ''}
      <div class="bk-chat-nav"><button class="btn ghost" id="back">← Back</button><button class="bk-big is-chat" id="next"></button></div>`;
    wirePlay(w);
    const ta = w.querySelector('.bk-answer'), next = w.querySelector('#next');
    const filled = () => (a.text && a.text.trim()) || a.voice_id;
    const label = () => { next.textContent = filled() ? 'Next →' : 'Skip →'; };
    label();
    ta.oninput = () => { a.text = ta.value; label(); };
    next.onclick = () => { chat.i++; renderStep(); };
    w.querySelector('#back').onclick = () => { chat.i--; renderStep(); };
    wireMic(w.querySelector('#mic'), w.querySelector('#ms'), step, (res) => {
      a.voice_id = res.voice_id;
      if (res.transcript) { a.text = `${a.text ? `${a.text.trim()} ` : ''}${res.transcript}`; ta.value = a.text; }
      w.querySelector('#vs').innerHTML = playButton(res.voice_id, 'My voice note');
      wirePlay(w.querySelector('#vs')); label();
    });
    const spin = w.querySelector('#spin');
    if (spin) spin.onclick = async () => {
      chat.spin++;
      const d = await F.kids.api(`/books/${current.book.id}/questions?spin=${chat.spin}`).catch(() => null);
      if (!d) return;
      const used = chat.questions.map((x) => x.slug);
      const fresh = d.questions.find((x) => !used.includes(x.slug));
      if (!fresh) return toast('That’s all the questions!');
      const idx = chat.questions.findIndex((x) => x.slug === step.slice(2));
      chat.questions[idx] = fresh;
      chat.steps[chat.i] = `q:${fresh.slug}`;
      chat.answers[`q:${fresh.slug}`] = chat.answers[`q:${fresh.slug}`] || { text: '', voice_id: null };
      renderStep();
    };
  }

  async function submitChat() {
    const b = current.book, w = body();
    const payload = { score: chat.score || null, liked: chat.answers.liked.text, liked_voice: chat.answers.liked.voice_id,
      disliked: chat.answers.disliked.text, disliked_voice: chat.answers.disliked.voice_id,
      answers: chat.questions.map((x) => ({ slug: x.slug, text: chat.answers[`q:${x.slug}`].text, voice_id: chat.answers[`q:${x.slug}`].voice_id })) };
    w.innerHTML = '<p class="muted center">Saving…</p>';
    let d;
    try { d = await F.kids.api(`/books/${b.id}/review`, { body: payload }); }
    catch (e) {
      w.innerHTML = `<p class="center">${esc(e.message || 'Oops — that didn’t save. Try again?')}</p><button class="bk-big is-chat" id="back">← Back to my Book Chat</button>`;
      w.querySelector('#back').onclick = renderStep;
      return;
    }
    current.review = d.review;
    w.innerHTML = `<div class="bk-celebrate"><div class="bk-confetti">🌟📚🌟</div><h2>Brilliant Book Chat!</h2>
      ${d.stars_awarded ? `<p class="bk-earned">+${d.stars_awarded} ⭐ for telling us about it</p>` : ''}
      <div class="bk-buddy"><div class="bk-buddy-who">💬 Book Buddy</div><div class="bk-buddy-text" id="bt">Buddy is reading what you said…</div></div>
      <button class="btn ghost hidden" id="speak">🔊 Read it to me</button><button class="bk-big is-chat" id="back">📚 Back to my book</button></div>`;
    F.kids.celebrate(d);
    w.querySelector('#back').onclick = () => openBook(document.getElementById('app'), b.id);
    const txt = w.querySelector('#bt'), speak = w.querySelector('#speak');
    speak.onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt.textContent.replace(/—\s*Buddy\s*$/, '')); u.lang = 'en-GB'; speechSynthesis.speak(u); } catch (_) {} };
    const r = await F.kids.api(`/books/${b.id}/buddy`, { body: {} }).catch(() => ({}));
    if (!w.isConnected) return;
    if (r.reply) { txt.textContent = r.reply; if (window.speechSynthesis) speak.classList.remove('hidden'); if (current.review) current.review.buddy_reply = r.reply; }
    else txt.textContent = 'Buddy is busy right now — but your Book Chat is saved on your shelf!';
  }

  // ---------- microphone: tap to start, tap to stop ----------
  function wireMic(btn, status, field, onSaved) {
    const MAX_MS = 45000;
    let recording = false, starting = false, cancelStart = false, recorder = null, chunks = [], timer = null, t0 = 0;
    const say = (t) => { status.textContent = t || ''; };
    const reflect = () => { btn.classList.toggle('recording', recording); btn.setAttribute('aria-pressed', String(recording)); btn.textContent = recording ? '⏹ Tap to stop' : '🎤 Say it'; };
    async function start() {
      if (recording || starting) return;
      if (!window.isSecureContext) { say('The microphone only works over a secure (https) address — you can type instead.'); return; }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { say('This device can’t record. You can type instead!'); return; }
      starting = true; cancelStart = false;
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { say(e && e.name === 'NotAllowedError' ? 'Allow the microphone (tap the padlock by the address).' : 'Couldn’t get the mic. You can type instead!'); return; }
      finally { starting = false; }
      if (cancelStart) { stream.getTracks().forEach((t) => t.stop()); return; }
      try {
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (_) { stream.getTracks().forEach((t) => t.stop()); say('This device can’t record in a format we understand.'); return; }
      chunks = [];
      recorder.addEventListener('dataavailable', (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 256) upload(blob, Math.round((Date.now() - t0) / 1000)); else say('That was too short. Try again?');
      });
      recorder.addEventListener('error', () => { stream.getTracks().forEach((t) => t.stop()); recording = false; reflect(); say('The mic stopped. Try again?'); });
      recorder.start(); t0 = Date.now();
      recording = true; reflect(); say('Listening… tap again when you’re done.');
      timer = setTimeout(stop, MAX_MS);
    }
    function stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (starting) { cancelStart = true; return; }
      if (!recording || !recorder) return;
      recording = false; reflect();
      try { recorder.stop(); } catch (_) {}
    }
    async function upload(blob, dur) {
      btn.disabled = true; say('Saving your voice note…');
      let d;
      try {
        const res = await fetch(withChild(`/api/kids/books/${current.book.id}/voice?field=${encodeURIComponent(field)}&dur=${dur}`),
          { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
        d = await res.json();
      } catch (_) { d = { ok: false }; }
      btn.disabled = false;
      if (!d.ok) { say('Couldn’t save that. Try again, or type it?'); return; }
      say(d.transcript ? 'Got it! I wrote down what you said — fix it if I got it wrong.' : 'Voice note saved! (I couldn’t write the words down — you can type them if you like.)');
      onSaved(d);
    }
    btn.onclick = (e) => { e.preventDefault(); if (recording || starting) stop(); else start(); };
    stopMic = stop;
    reflect();
  }
  window.addEventListener('pagehide', () => { if (stopMic) stopMic(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && stopMic) stopMic(); });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#k/books/')) stopAll(); });

  F.kids.register({
    id: 'books', emoji: '📚', name: 'Books', colour: '#4a9abf', order: 20, tab: true,
    render: async (el, rest) => (rest && /^[0-9a-f-]{36}$/i.test(rest) ? openBook(el, rest) : shelf(el)),
  });
})();
