/* Kids → Library: stories and audio made for them (only what a parent approved). Playing one makes the sprig happy.
 * Also defines F.kmedia — the little audio player the Stories, Today and Learn screens share.
 * Route: #k/library */
(function () {
  const { esc, toast } = F;

  const withChild = (u) => (F.kids.viewingChild ? `${u}${u.includes('?') ? '&' : '?'}child=${encodeURIComponent(F.kids.viewingChild)}` : u);
  const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
  const KIND = { story: ['🌙', 'Story'], episode: ['🎙️', 'Episode'], article_audio: ['📰', 'Article'], newspaper: ['📰', 'News'] };
  const kindLabel = (k) => (KIND[k] || ['🎧', String(k || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())]);

  /** A player: <audio> + speed buttons. src is an app URL; onFirstPlay runs once. */
  function player(src, { id = '' } = {}) {
    return `<div class="km-player" data-pid="${esc(id)}"><audio controls preload="none" src="${esc(src)}"></audio>
      <div class="km-rate" role="group" aria-label="Speed">${['0.8', '1', '1.2'].map((r) => `<button type="button" data-rate="${r}" class="${r === '1' ? 'on' : ''}">${r}×</button>`).join('')}</div></div>`;
  }
  function wire(el, onFirstPlay) {
    el.querySelectorAll('.km-player').forEach((p) => {
      const a = p.querySelector('audio');
      p.querySelectorAll('[data-rate]').forEach((b) => b.onclick = () => {
        a.playbackRate = parseFloat(b.dataset.rate);
        p.querySelectorAll('[data-rate]').forEach((x) => x.classList.toggle('on', x === b));
      });
      let once = false;
      a.addEventListener('play', () => {
        el.querySelectorAll('audio').forEach((o) => { if (o !== a) o.pause(); });   // one at a time
        if (!once && onFirstPlay) { once = true; onFirstPlay(p.dataset.pid); }
      });
    });
  }
  const stopAll = (el) => (el || document).querySelectorAll('audio').forEach((a) => { try { a.pause(); } catch (_) {} });
  async function played(id) {
    if (!id) return;
    try { F.kids.celebrate(await F.kids.api(`/library/${id}/played`, { body: {} })); } catch (_) { /* never mind */ }
  }
  F.kmedia = { player, wire, played, stopAll, withChild, dur, kindLabel, itemUrl: (id) => withChild(`/api/kids/library/${id}/audio`) };

  let filter = '';
  async function render(el) {
    const d = await F.kids.api('/library');
    const kinds = [...new Set(d.items.map((i) => i.kind))];
    const list = d.items.filter((i) => !filter || i.kind === filter);
    el.innerHTML = `<div class="kids km">${F.kids.header('Listen', '🎧')}
      ${kinds.length > 1 ? `<div class="km-chips" role="group" aria-label="Show">${[['', 'All'], ...kinds.map((k) => [k, `${kindLabel(k)[0]} ${kindLabel(k)[1]}s`])].map(([k, l]) =>
        `<button type="button" class="km-chip ${k === filter ? 'on' : ''}" data-k="${esc(k)}">${esc(l)}</button>`).join('')}</div>` : ''}
      ${list.length ? list.map((it) => `<div class="card kid-card km-item">
          <div class="km-title">${esc(it.title)}</div>
          <div class="km-meta"><span class="km-badge">${kindLabel(it.kind)[0]} ${esc(kindLabel(it.kind)[1])}</span>${it.duration_s ? `<span>${dur(it.duration_s)}</span>` : ''}${it.last_played_at ? '<span>✓ heard</span>' : ''}</div>
          ${player(F.kmedia.itemUrl(it.id), { id: it.id })}</div>`).join('')
        : `<div class="card kid-card center"><div style="font-size:3rem">🎧</div><p>Nothing here yet.</p><a class="btn" href="#k/stories">🌙 Make a story</a></div>`}</div>`;
    el.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { filter = b.dataset.k; render(el); });
    wire(el, played);
  }

  F.kids.register({ id: 'library', emoji: '🎧', name: 'Listen', colour: '#7c6fd0', order: 32, render });
  window.addEventListener('hashchange', () => stopAll());
})();
