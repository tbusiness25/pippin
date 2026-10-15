/* Kids → Collection: every item in a searchable catalogue, with "my picks" favourites and a guide.
 * The catalogue and pictures come from the server's data folder (not shipped with the app).
 * Routes: #k/collection · #k/collection/guide */
(function () {
  const { esc, toast } = F;
  const TITLE_KEY = 'kids-collection-title';
  const store = { get: () => { try { return localStorage.getItem(TITLE_KEY); } catch (_) { return null; } }, set: (v) => { try { localStorage.setItem(TITLE_KEY, v); } catch (_) {} } };
  const st = { all: null, meta: null, filter: 'all', q: '' };
  const sprite = (p) => (p.sprite ? F.kmedia.withChild(`/api/kids/collection/sprites/${encodeURIComponent(p.sprite)}`) : '');
  const typeBadge = (meta, t) => `<span class="pk-type" style="background:${esc((meta.typeColours || {})[t] || '#777')}">${esc(t)}</span>`;

  function filtered() {
    return st.all.filter((p) => {
      if (st.q && !(p.name.toLowerCase().includes(st.q) || String(p.national_num) === st.q || String(p.num) === st.q)) return false;
      if (st.filter === 'all') return true;
      if (st.filter === 'fav') return p.favourite;
      if (st.filter === 'legendary') return p.is_legendary;
      return p.habitat === st.filter;
    });
  }
  function grid(el) {
    const list = filtered();
    el.querySelector('#pk-count').textContent = `${list.length} ${st.meta.item}`;
    el.querySelector('#pk-grid').innerHTML = list.length ? list.map((p) => `<button type="button" class="pk-card ${p.is_legendary ? 'legend' : ''}" data-n="${p.num}">
        <span class="pk-hero">${p.sprite ? `<img src="${esc(sprite(p))}" alt="" loading="lazy" decoding="async">` : '❔'}${p.favourite ? '<span class="pk-fav">⭐</span>' : ''}</span>
        <span class="pk-num">#${esc(p.national_num ?? p.num)}</span><b>${esc(p.name)}</b>
        <span class="pk-types">${(p.types || []).map((t) => typeBadge(st.meta, t)).join('')}</span></button>`).join('')
      : `<p class="muted center">No ${esc(st.meta.item)} match that.</p>`;
    el.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => detail(el, st.all.find((p) => p.num === +b.dataset.n)));
  }

  function detail(el, p) {
    const m = st.meta;
    F.sheet(`<div class="pk-detail ${p.is_legendary ? 'legend' : ''}">${p.sprite ? `<img src="${esc(sprite(p))}" alt="${esc(p.name)}">` : ''}
      <h1>${esc(p.name)}</h1><p class="muted small">${m.subtitle ? `${esc(m.subtitle)} #${p.num} · ` : ''}${p.national_num != null ? `National #${p.national_num} · ` : ''}Gen ${esc(p.generation)}</p>
      <div class="pk-types">${(p.types || []).map((t) => typeBadge(m, t)).join('')}</div>
      ${p.habitat ? `<p>${esc((m.areas || {})[p.habitat] || '🗺️')} Likely home: <b>${esc(p.habitat)}</b></p>` : ''}
      ${p.is_legendary ? '<p class="kid-pill">✨ Legendary</p>' : ''}${p.form_note ? `<p class="small">${esc(p.form_note)}</p>` : ''}
      <button class="btn block big" id="pk-fav">${p.favourite ? '⭐ In my team' : '☆ Add to my team'}</button></div>`, (sh, close) => {
      sh.querySelector('#pk-fav').onclick = async () => {
        try {
          const r = await F.kids.api(`/collection/${p.num}/favourite`, { body: {} });
          p.favourite = r.favourite; F.kids.celebrate(r); close(); grid(el);
        } catch (e) { toast(e.message); }
      };
    });
  }

  async function guide(el) {
    const { guide: g } = await F.kids.api('/collection/guide');
    el.innerHTML = `<div class="kids pk">${F.kids.header('Guide', '🗺️', '#k/collection')}
      ${g ? `<p class="kid-story">${esc(g.intro || '')}</p>
        ${(g.areas || []).length ? `<h2>The places you build</h2>${g.areas.map((a) => `<div class="card kid-card"><b>${esc(a.emoji)} ${esc(a.title)}</b><div class="small muted">${esc(a.biome || '')}</div><p>${esc(a.likes || '')}</p></div>`).join('')}` : ''}
        ${(g.tips || []).length ? `<h2>Top tips</h2>${g.tips.map((t) => `<div class="card kid-card pk-tip"><span class="em">${esc(t.emoji)}</span><span>${esc(t.text)}</span></div>`).join('')}` : ''}`
        : '<p class="muted">No guide yet.</p>'}</div>`;
  }

  async function render(el, rest) {
    if (rest === 'guide') return guide(el);
    const d = await F.kids.api('/collection');
    st.all = d.items; st.meta = d.meta;
    if (d.meta.title && d.meta.title !== store.get()) { store.set(d.meta.title); F.kids.modules.collection.name = d.meta.title; }
    if (!st.all.length) { el.innerHTML = `<div class="kids">${F.kids.header(d.meta.title, '⚡')}<div class="card kid-card center"><p>Nothing here yet.</p></div></div>`; return; }
    const chips = [['all', 'All'], ['fav', '⭐ My team'], ['legendary', '✨ Legendary'], ...(d.meta.filters || [])];
    el.innerHTML = `<div class="kids pk">${F.kids.header(d.meta.title, '⚡')}
      ${d.meta.hasGuide ? '<a class="btn secondary block" href="#k/collection/guide">🗺️ Guide & tips</a>' : ''}
      <input type="search" id="pk-q" placeholder="Search by name or number…" maxlength="40" autocomplete="off" value="${esc(st.q)}" style="margin:12px 0 8px">
      <div class="km-chips">${chips.map(([k, l]) => `<button type="button" class="km-chip ${k === st.filter ? 'on' : ''}" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>
      <p class="small muted" id="pk-count"></p><div class="pk-grid" id="pk-grid"></div></div>`;
    el.querySelector('#pk-q').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); grid(el); });
    el.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { st.filter = b.dataset.f; el.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); grid(el); });
    grid(el);
  }

  F.kids.register({ id: 'collection', emoji: '⚡', name: store.get() || 'Collection', colour: '#e3b62e', order: 45, render });
})();
