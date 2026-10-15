/* Family → a child → Books: what they're reading / finished, their Book Chats (with voice notes to play), "we own it"
 * per book, a shopping list (not read and not owned, plus the next book in any series they've started, with an
 * Amazon UK search link), and add / edit / hide books or set a status for them.
 * Routes: #family/child/<id>/books[/shelf|/reviews|/shop|/book/<bookId>|/edit/<bookId>|/new] */
(function () {
  const { esc, toast } = F;
  const STATUS = { not_read: 'Not read yet', reading: 'Reading', finished: 'Finished' };
  const OWNED = (v) => (v === true ? 'We own it' : v === false ? 'Don’t own' : 'Own it?');
  const base = (c) => `#family/child/${c.id}/books`;
  const withChild = (c, u) => (u ? `${u}${u.includes('?') ? '&' : '?'}child=${encodeURIComponent(c.id)}` : u);
  const nice = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const seriesLine = (b) => (!b.series ? b.shelf_group || '' : b.series + (b.series_num ? ` #${b.series_num}` : b.kind === 'activity' ? ' (activity)' : b.kind === 'special' ? ' (special)' : ''));
  const pill = (s) => `<span class="mb-pill is-${s}">${s === 'finished' ? '✓' : s === 'reading' ? '📖' : '●'} ${STATUS[s]}</span>`;
  const coverImg = (c, b, cls = 'mb-cover') => (b.cover ? `<img class="${cls}" alt="" loading="lazy" src="${esc(withChild(c, b.cover))}">` : `<div class="${cls} mb-fake">${esc((b.title || '?').slice(0, 1))}</div>`);
  const amazon = (b) => `<a class="mb-amazon" target="_blank" rel="noopener noreferrer" href="https://www.amazon.co.uk/s?k=${encodeURIComponent([b.title, b.author].filter(Boolean).join(' ')).replace(/%20/g, '+')}">Amazon UK ↗</a>`;
  const audio = (c, id) => `<audio class="mb-audio" controls preload="none" src="${esc(withChild(c, `/api/kids/books/voice/${encodeURIComponent(id)}`))}"></audio>`;
  const api = (c, p, o) => F.family.kapi(c, `/books${p}`, o);

  async function render(el, child, rest = '') {
    const [view, id] = rest.split('/');
    if (view === 'shelf') return shelf(el, child);
    if (view === 'reviews') return reviews(el, child);
    if (view === 'shop') return shop(el, child);
    if (view === 'book' && id) return detail(el, child, id);
    if (view === 'edit' && id) return edit(el, child, id);
    if (view === 'new') return edit(el, child, null);
    return overview(el, child);
  }

  async function overview(el, c) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const [d, rv] = await Promise.all([api(c, '/parent'), api(c, '/parent/reviews')]);
    const s = d.stats;
    const reading = d.items.filter((b) => b.status === 'reading' && !b.hidden);
    el.innerHTML = `<h1>📚 ${esc(c.name)}’s books</h1>
      <div class="mb-facts">${[[s.finished, 'finished'], [s.this_year, `in ${s.year}`], [s.reading, 'reading now'], [rv.reviews.length, 'Book Chats']].map(([n, l]) => `<div><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
      ${reading.length ? `<h2 class="mb-h">Reading now</h2>${reading.map((b) => row(c, b, true)).join('')}` : ''}
      ${rv.reviews.length ? `<h2 class="mb-h">Latest Book Chats</h2>${rv.reviews.slice(0, 2).map((r) => reviewCard(c, r, rv.voices, true)).join('')}` : ''}
      <div class="mb-actions">
        <a class="btn" href="${base(c)}/shelf">📚 Bookshelf (${d.items.filter((b) => !b.hidden).length})</a>
        <a class="btn secondary" href="${base(c)}/reviews">💬 Book Chats (${rv.reviews.length})</a>
        <a class="btn secondary" href="${base(c)}/shop">🛒 Shopping list (${shopping(d.items).length})</a>
        <a class="btn secondary" href="${base(c)}/new">＋ Add a book</a></div>`;
  }

  function row(c, b, compact) {
    return `<div class="mb-row${b.hidden ? ' is-hidden' : ''}" data-id="${b.id}">${coverImg(c, b)}
      <div class="mb-mid"><a class="mb-title" href="${base(c)}/book/${b.id}">${esc(b.title)}</a>
        <div class="mb-sub">${esc([b.author, seriesLine(b)].filter(Boolean).join(' · '))}</div>
        <div class="mb-meta">${pill(b.status)}${b.score ? `<span class="mb-score">★ ${b.score}/7</span>` : ''}${b.finished_on ? `<span class="mb-sub">${nice(b.finished_on)}</span>` : ''}
          ${b.voice_count ? `<span class="mb-sub">🎤 ${b.voice_count}</span>` : ''}${b.hidden ? `<span class="mb-sub">hidden from ${esc(c.name)}</span>` : ''}</div></div>
      ${compact ? '' : `<div class="mb-ctl"><select class="mb-select" data-status aria-label="Status for ${esc(b.title)}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="mb-owned${b.owned === true ? ' is-yes' : b.owned === false ? ' is-no' : ''}" data-owned>${OWNED(b.owned)}</button></div>`}</div>`;
  }

  // Status select + owned toggle (Own it? → We own it → Don't own → Own it?) on every row inside `root`.
  function wireRows(root, c, items, redraw) {
    root.querySelectorAll('.mb-row[data-id]').forEach((r) => {
      const b = items.find((x) => x.id === r.dataset.id);
      const sel = r.querySelector('[data-status]');
      if (sel) sel.onchange = async () => {
        try { await api(c, `/parent/${b.id}`, { method: 'PATCH', body: { status: sel.value } }); b.status = sel.value; if (b.status !== 'finished') b.finished_on = null; redraw(); }
        catch (e) { toast(e.message); sel.value = b.status; }
      };
      const own = r.querySelector('[data-owned]');
      if (own) own.onclick = async () => {
        const next = b.owned == null ? true : b.owned === true ? false : null;
        try { await api(c, `/parent/${b.id}`, { method: 'PATCH', body: { owned: next } }); b.owned = next; redraw(); } catch (e) { toast(e.message); }
      };
    });
  }

  const shelfState = { q: '', status: 'all', owned: 'all', group: '', hidden: false };
  async function shelf(el, c) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const { items } = await api(c, '/parent');
    const groups = [...new Set(items.map((b) => b.shelf_group))];
    const sel = (key, opts) => `<select class="mb-select" data-k="${key}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${shelfState[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    el.innerHTML = `<h1>${esc(c.name)}’s bookshelf</h1><div class="mb-tools">
      <input type="search" class="mb-input" id="q" placeholder="Search title, author, series…" value="${esc(shelfState.q)}">
      ${sel('status', [['all', 'Any status'], ['finished', 'Finished'], ['reading', 'Reading'], ['not_read', 'Not read yet']])}
      ${sel('owned', [['all', 'Owned or not'], ['yes', 'We own it'], ['no', 'Don’t own'], ['unknown', 'Not marked yet']])}
      ${sel('group', [['', 'Every shelf'], ...groups.map((g) => [g, g])])}
      <label class="mb-check"><input type="checkbox" id="hid" ${shelfState.hidden ? 'checked' : ''}> show hidden</label></div>
      <div class="mb-count" id="count"></div><div id="list"></div>`;
    const draw = () => {
      const s = shelfState;
      const shown = items.filter((b) => (s.hidden || !b.hidden) && (s.status === 'all' || b.status === s.status)
        && (s.owned !== 'yes' || b.owned === true) && (s.owned !== 'no' || b.owned === false) && (s.owned !== 'unknown' || b.owned == null)
        && (!s.group || b.shelf_group === s.group) && (!s.q || [b.title, b.author, b.series].some((x) => (x || '').toLowerCase().includes(s.q))));
      el.querySelector('#count').textContent = `${shown.length} of ${items.length} books`;
      let last = null;
      const list = el.querySelector('#list');
      list.innerHTML = shown.slice(0, 600).map((b) => { const h = b.shelf_group !== last ? `<div class="mb-group">${esc(b.shelf_group)}</div>` : ''; last = b.shelf_group; return h + row(c, b, false); }).join('');
      wireRows(list, c, items, draw);
    };
    el.querySelectorAll('[data-k]').forEach((s) => s.onchange = () => { shelfState[s.dataset.k] = s.value; draw(); });
    el.querySelector('#hid').onchange = (e) => { shelfState.hidden = e.target.checked; draw(); };
    let t = null;
    el.querySelector('#q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { shelfState.q = e.target.value.trim().toLowerCase(); draw(); }, 200); };
    draw();
  }

  // Not read, not owned (unknown counts as not owned unless "only marked"), plus the next unread book in each series they've started.
  const shopping = (items, onlyMarked) => items.filter((b) => !b.hidden && !b.requested_at && b.status === 'not_read' && (onlyMarked ? b.owned === false : b.owned !== true));
  const asked = (items) => items.filter((b) => !b.hidden && b.requested_at && b.owned !== true).sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
  function nextUp(items) {
    const by = new Map();
    items.forEach((b) => { if (b.series && !b.hidden) { if (!by.has(b.series)) by.set(b.series, []); by.get(b.series).push(b); } });
    const out = [];
    by.forEach((list) => {
      if (!list.some((b) => b.status !== 'not_read')) return;
      const n = list.filter((b) => b.series_num && b.status === 'not_read' && b.owned !== true).sort((a, b) => a.series_num - b.series_num)[0];
      if (n) out.push(n);
    });
    return out;
  }
  let onlyMarked = false;
  async function shop(el, c) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const { items } = await api(c, '/parent');
    const draw = () => {
      const shopRow = (b) => `<div class="mb-row" data-id="${b.id}">${coverImg(c, b)}<div class="mb-mid"><div class="mb-title-plain">${esc(b.title)}</div>
        <div class="mb-sub">${esc([b.author, seriesLine(b)].filter(Boolean).join(' · '))}</div>${amazon(b)}</div>
        <div class="mb-ctl"><button class="mb-owned" data-set="true">✓ We own it</button>${b.owned !== false ? '<button class="mb-owned is-no" data-set="false">Don’t own</button>' : ''}</div></div>`;
      const askRow = (b) => `<div class="mb-row" data-id="${b.id}">${coverImg(c, b)}<div class="mb-mid"><div class="mb-title-plain">${esc(b.title)}</div>
        <div class="mb-sub">${esc([b.author, seriesLine(b)].filter(Boolean).join(' · '))} · asked ${esc(new Date(b.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}</div>${amazon(b)}</div>
        <div class="mb-ctl"><button class="mb-owned" data-set="true">✓ Bought it</button><button class="mb-owned is-no" data-decline>Not now</button></div></div>`;
      const ask = asked(items);
      const nu = nextUp(items).filter((b) => !b.requested_at), list = shopping(items, onlyMarked);
      let g = null;
      el.innerHTML = `<h1>Books to buy</h1><p class="muted small">Books ${esc(c.name)} hasn’t read that you don’t own. Tap “We own it” to take one off the list. “Not marked yet” counts as not owned unless you tick below.</p>
        ${ask.length ? `<div class="mb-group">🛒 ${esc(c.name)} asked for these</div>${ask.map(askRow).join('')}` : ''}
        <label class="mb-check"><input type="checkbox" id="om" ${onlyMarked ? 'checked' : ''}> only books marked “Don’t own”</label>
        ${nu.length ? `<div class="mb-group">⭐ Next in a series they’re reading</div>${nu.map(shopRow).join('')}` : ''}
        <div class="mb-count">${list.length} books</div>
        ${list.map((b) => { const h = b.shelf_group !== g ? `<div class="mb-group">${esc(b.shelf_group)}</div>` : ''; g = b.shelf_group; return h + shopRow(b); }).join('')}`;
      el.querySelector('#om').onchange = (e) => { onlyMarked = e.target.checked; draw(); };
      el.querySelectorAll('[data-decline]').forEach((btn) => btn.onclick = async () => {
        const b = items.find((x) => x.id === btn.closest('.mb-row').dataset.id);
        try { await api(c, `/parent/${b.id}`, { method: 'PATCH', body: { request: null } }); b.requested_at = null; draw(); } catch (e) { toast(e.message); }
      });
      el.querySelectorAll('[data-set]').forEach((btn) => btn.onclick = async () => {
        const b = items.find((x) => x.id === btn.closest('.mb-row').dataset.id);
        const v = btn.dataset.set === 'true';
        try { await api(c, `/parent/${b.id}`, { method: 'PATCH', body: { owned: v } }); b.owned = v; if (v) b.requested_at = null; draw(); } catch (e) { toast(e.message); }
      });
    };
    draw();
  }

  function reviewCard(c, r, voices, compact) {
    const qa = (q, text, vid) => (!text && !vid ? '' : `<div class="mb-qa"><div class="mb-q">${esc(q)}</div>${text ? `<div class="mb-a">${esc(text)}</div>` : ''}
      ${vid ? (compact ? '<div class="mb-sub">🎤 voice note</div>' : audio(c, vid)) : ''}</div>`);
    const used = new Set([r.liked_voice, r.disliked_voice, ...(r.answers || []).map((a) => a.voice_id)].filter(Boolean));
    const extra = compact ? [] : (voices || []).filter((v) => v.book_id === r.book_id && !used.has(v.id));
    const inner = `<div class="mb-review-head">${coverImg(c, r)}<div class="mb-mid"><div class="mb-title-plain">${esc(r.title)}</div>
        <div class="mb-sub">${esc([r.author, r.finished_on ? `finished ${nice(r.finished_on)}` : null].filter(Boolean).join(' · '))}</div>
        ${r.score ? `<div class="mb-stars">${'★'.repeat(r.score)}${'☆'.repeat(7 - r.score)}  ${r.score}/7</div>` : ''}</div></div>
      ${qa('Liked', r.liked, r.liked_voice)}${qa('Didn’t like', r.disliked, r.disliked_voice)}${(r.answers || []).map((a) => qa(a.question, a.text, a.voice_id)).join('')}
      ${r.buddy_reply ? `<div class="mb-buddy"><div class="mb-q">💬 Book Buddy replied${r.buddy_flag ? ` (held back: ${esc(r.buddy_flag.split(':')[0])})` : ''}</div><div class="mb-a">${esc(r.buddy_reply)}</div></div>` : ''}
      ${extra.length ? `<div class="mb-qa"><div class="mb-q">Other recordings (${extra.length})</div>${extra.map((v) => `${v.transcript ? `<div class="mb-sub">“${esc(v.transcript)}”</div>` : ''}${audio(c, v.id)}`).join('')}</div>` : ''}`;
    return compact ? `<a class="mb-review is-link" href="${base(c)}/book/${r.book_id}">${inner}</a>` : `<div class="mb-review">${inner}</div>`;
  }

  async function reviews(el, c) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const d = await api(c, '/parent/reviews');
    el.innerHTML = `<h1>${esc(c.name)}’s Book Chats</h1>${d.reviews.length ? d.reviews.map((r) => reviewCard(c, r, d.voices, false)).join('')
      : '<p class="muted">No Book Chats yet. They appear here when a book is finished and they tell Buddy about it.</p>'}`;
  }

  async function detail(el, c, id) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const d = await api(c, `/parent/${id}`);
    const b = d.book;
    el.innerHTML = `<div class="mb-review-head">${coverImg(c, b, 'mb-cover mb-cover-lg')}<div class="mb-mid"><h1 class="mb-big">${esc(b.title)}</h1>
        <div class="mb-sub">${esc([b.author, seriesLine(b)].filter(Boolean).join(' · '))}</div>${pill(b.status)}${amazon(b)}
        <div class="mb-sub">Source: ${esc(b.source || '—')} ${b.verified ? '(verified)' : '(unverified)'}</div></div></div>
      <div class="card mb-form"><h2 class="mb-h">Status (set for ${esc(c.name)})</h2>
        <label class="mb-lab"><span>Status</span><select class="mb-select" id="ss">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="mb-lab"><span>Started</span><input type="date" class="mb-input" id="sd" value="${esc(b.started_on || '')}"></label>
        <label class="mb-lab"><span>Finished</span><input type="date" class="mb-input" id="fd" value="${esc(b.finished_on || '')}"></label>
        <button class="btn" id="save">Save status</button>
        <div class="mb-actions"><button class="mb-owned${b.owned === true ? ' is-yes' : b.owned === false ? ' is-no' : ''}" id="own">${OWNED(b.owned)}</button>
          <button class="btn ${b.hidden ? 'secondary' : 'ghost'}" id="hide">${b.hidden ? `Show to ${esc(c.name)} again` : `Hide from ${esc(c.name)}`}</button>
          <a class="btn secondary" href="${base(c)}/edit/${b.id}">✏️ Edit details</a></div></div>
      ${d.review ? `<h2 class="mb-h">Their Book Chat</h2>${reviewCard(c, Object.assign({ title: b.title, author: b.author, cover: b.cover, book_id: b.id, finished_on: b.finished_on }, d.review), d.voices.map((v) => Object.assign({ book_id: b.id }, v)), false)}`
        : d.voices.length ? `<h2 class="mb-h">Voice notes</h2>${d.voices.map((v) => audio(c, v.id)).join('')}` : ''}
      ${d.voices.length ? `<div class="card mb-form"><h2 class="mb-h">Manage voice notes</h2>${d.voices.map((v) => `<div class="mb-voice-row"><span class="mb-sub">${nice(v.created_at)} · ${esc(v.field.replace(/^q:/, ''))}${v.vault_note ? ' · filed in voice notes' : ''}</span>
        <button class="btn ghost" data-rm="${v.id}">Remove</button></div>`).join('')}</div>` : ''}
      ${d.history.length ? `<h2 class="mb-h">History</h2><ul class="mb-history">${d.history.map((h) => {
        const x = h.detail || {};
        const what = h.kind === 'status' ? `${STATUS[x.from] || x.from} → ${STATUS[x.to] || x.to}` : h.kind === 'owned' ? OWNED(x.to) : h.kind;
        return `<li>${nice(h.created_at)} · ${esc(what)} (${esc(h.by)})</li>`;
      }).join('')}</ul>` : ''}`;
    const again = () => detail(el, c, id);
    const patch = async (body) => { try { await api(c, `/parent/${b.id}`, { method: 'PATCH', body }); again(); } catch (e) { toast(e.message); } };
    el.querySelector('#save').onclick = () => {
      const s = el.querySelector('#ss').value, body = { status: s };
      if (s !== 'not_read') body.started_on = el.querySelector('#sd').value || null;
      if (s === 'finished') body.finished_on = el.querySelector('#fd').value || '';
      patch(body);
    };
    el.querySelector('#own').onclick = () => patch({ owned: b.owned == null ? true : b.owned === true ? false : null });
    el.querySelector('#hide').onclick = () => patch({ hidden: !b.hidden });
    el.querySelectorAll('[data-rm]').forEach((btn) => btn.onclick = async () => {
      if (!confirm('Remove this voice note? (It is hidden, not destroyed — a copy stays in the voice-notes folder.)')) return;
      try { await api(c, `/parent/voice/${btn.dataset.rm}/remove`, { body: {} }); again(); } catch (e) { toast(e.message); }
    });
  }

  async function edit(el, c, id) {
    const b = id ? (await api(c, `/parent/${id}`)).book : null;
    const inp = (k, label, v, type = 'text') => `<label class="mb-lab"><span>${label}</span><input class="mb-input" id="f-${k}" type="${type}" value="${esc(v ?? '')}"></label>`;
    el.innerHTML = `<h1>${b ? 'Edit book' : 'Add a book'}</h1><div class="card mb-form">
      ${b ? `<p class="small muted">Title, author and series changes apply to the shared book list for every child.</p>` : ''}
      ${inp('title', 'Title', b?.title)}${inp('author', 'Author', b?.author)}${inp('series', 'Series', b?.series)}
      ${inp('series_num', 'Number in series', b?.series_num, 'number')}${inp('group', 'Shelf (group)', b?.shelf_group)}
      <label class="mb-lab"><span>Kind</span><select class="mb-select" id="f-kind">${[['standalone', 'Standalone'], ['main', 'Main series'], ['special', 'Special'], ['activity', 'Activity / joke book']]
        .map(([v, l]) => `<option value="${v}" ${(b ? b.kind : 'standalone') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${b ? '' : `<label class="mb-lab"><span>Owned</span><select class="mb-select" id="f-owned"><option value="">Own it? (not sure)</option><option value="yes">We own it</option><option value="no">Don’t own</option></select></label>`}
      <button class="btn" id="save">${b ? 'Save changes' : 'Add book'}</button></div>`;
    el.querySelector('#save').onclick = async () => {
      const v = (k) => el.querySelector(`#f-${k}`).value.trim();
      const body = { title: v('title'), author: v('author'), series: v('series'), series_num: v('series_num'), group: v('group'), kind: v('kind') };
      if (body.title.length < 2) return el.querySelector('#f-title').focus();
      try {
        if (b) { await api(c, `/parent/${b.id}`, { method: 'PATCH', body }); F.go(`${base(c)}/book/${b.id}`); }
        else {
          const o = v('owned');
          const r = await api(c, '/parent', { body: Object.assign(body, { owned: o === 'yes' ? true : o === 'no' ? false : null }) });
          F.go(`${base(c)}/book/${r.id}`);
        }
      } catch (e) { toast(e.message); }
    };
  }

  F.family.childPanel({ id: 'books', module: 'books', emoji: '📚', name: 'Books', sub: 'Shelf, Book Chats, shopping list', order: 30, render });
})();
