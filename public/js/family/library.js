/* Library for grown-ups:
 *  - #library — your own audio (audio an automation made for you), with approve/reject for new arrivals.
 *    Shows as an Explore tile once you have anything.
 *  - Family → child → "Library" — approve or reject what a child can hear, and preview it first. */
(function () {
  const { api, esc, toast } = F;
  const $app = document.getElementById('app');
  const COUNT_KEY = 'finch-lib-count';
  const getCount = () => { try { return +localStorage.getItem(COUNT_KEY) || 0; } catch (_) { return 0; } };
  const setCount = (n) => { try { localStorage.setItem(COUNT_KEY, String(n)); } catch (_) {} };
  const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
  const when = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const playerHtml = (src, id) => `<div class="km-player" data-pid="${esc(id || '')}"><audio controls preload="none" src="${esc(src)}"></audio>
    <div class="km-rate" role="group" aria-label="Speed">${['1', '1.25', '1.5'].map((r) => `<button type="button" data-rate="${r}" class="${r === '1' ? 'on' : ''}">${r}×</button>`).join('')}</div></div>`;
  function wire(el, onFirstPlay) {
    el.querySelectorAll('.km-player').forEach((p) => {
      const a = p.querySelector('audio');
      p.querySelectorAll('[data-rate]').forEach((b) => b.onclick = () => { a.playbackRate = +b.dataset.rate; p.querySelectorAll('[data-rate]').forEach((x) => x.classList.toggle('on', x === b)); });
      let once = false;
      a.addEventListener('play', () => { el.querySelectorAll('audio').forEach((o) => { if (o !== a) o.pause(); }); if (!once && onFirstPlay) { once = true; onFirstPlay(p.dataset.pid); } });
    });
  }

  // ---------- your own library ----------
  async function page() {
    F.setTab('explore');
    const d = await api('/api/family/library');
    setCount(d.items.length + d.pending.length);
    $app.innerHTML = `<a href="#explore" class="btn ghost" style="padding-left:0">‹ Explore</a><h1>🎧 Listen</h1>
      ${d.pending.length ? `<div class="card"><h2>New — keep or skip?</h2>${d.pending.map((it) => `<div class="km-item" data-id="${it.id}">
          <b>${esc(it.title)}</b><div class="small muted">${esc(it.kind.replace(/_/g, ' '))} · ${when(it.created_at)}${it.audio_status !== 'ready' ? ` · ${esc(it.audio_status)}` : ''}</div>
          ${it.preview ? `<p class="small">${esc(it.preview)}…</p>` : ''}
          ${it.audio_status === 'ready' ? playerHtml(`/api/family/library/${it.id}/audio`) : ''}
          <div class="row" style="gap:8px;margin-top:8px"><button class="btn" data-a="approve">Keep</button><button class="btn secondary" data-a="reject">Skip</button></div></div>`).join('')}</div>` : ''}
      ${d.items.length ? d.items.map((it) => `<div class="card km-item"><b>${esc(it.title)}</b>
          <div class="small muted">${esc(it.kind.replace(/_/g, ' '))} · ${when(it.created_at)}${it.duration_s ? ` · ${dur(it.duration_s)}` : ''}${it.last_played_at ? ' · ✓ played' : ''}</div>
          ${playerHtml(`/api/family/library/${it.id}/audio`, it.id)}</div>`).join('')
        : (d.pending.length ? '' : '<div class="card"><p>Nothing here yet.</p><p class="small muted">Audio made for you by your automations appears here.</p></div>')}`;
    wire($app, (id) => id && api(`/api/family/library/${id}/played`, { body: {} }).catch(() => {}));
    $app.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
      const id = b.closest('[data-id]').dataset.id;
      try { await api(`/api/family/library/${id}/${b.dataset.a}`, { body: {} }); toast(b.dataset.a === 'approve' ? 'Kept ✓' : 'Skipped'); page(); }
      catch (e) { toast(e.message); }
    });
  }
  F.routes.library = page;

  // Explore tile — only for people who have something to listen to.
  if (F.explore && F.explore.tile) {
    F.explore.tile({ href: '#library', emoji: '🎧', name: 'Listen', sub: 'Audio', show: (s) => !!(s && s.user && s.user.role === 'adult' && getCount() > 0) });
  }
  async function refreshCount() {
    const s = F.state;
    if (!s || !s.user || s.user.role !== 'adult') return;
    try {
      const r = await api('/api/family/library/summary');
      const n = (r.ready || 0) + (r.pending || 0), before = getCount();
      setCount(n);
      if ((n > 0) !== (before > 0) && (location.hash || '#home').startsWith('#explore') && !location.hash.includes('/')) F.routes.explore && F.routes.explore('');
    } catch (_) { /* offline */ }
  }
  window.addEventListener('hashchange', () => { if ((location.hash || '').startsWith('#explore')) refreshCount(); });
  setTimeout(refreshCount, 4000);

  // ---------- a child's library (parents) ----------
  F.family.childPanel({ id: 'library', module: 'library', emoji: '🎧', name: 'Library', sub: 'What they can listen to', order: 40,
    async render(el, child, rest) {
      const status = ['pending', 'approved', 'rejected', 'all'].includes(rest) ? rest : 'pending';
      const d = await F.family.kapi(child, `/library/review?status=${status}`);
      const src = (id) => `/api/kids/library/${id}/audio?child=${encodeURIComponent(child.id)}`;
      el.innerHTML = `<h1>🎧 ${esc(child.name)}’s library</h1>
        <div class="tabs2">${[['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) =>
          `<a class="chip ${k === status ? 'on' : ''}" href="#family/child/${child.id}/library/${k}" style="text-decoration:none">${l}</a>`).join('')}</div>
        ${d.items.length ? d.items.map((it) => `<div class="card km-item" data-id="${it.id}"><b>${esc(it.title)}</b>
            <div class="small muted">${esc(it.kind.replace(/_/g, ' '))} · ${when(it.created_at)}${it.duration_s ? ` · ${dur(it.duration_s)}` : ''} · ${it.rejected_at ? `rejected${it.rejected_reason ? ` (${esc(it.rejected_reason)})` : ''}` : it.approved ? 'approved' : 'waiting'}${it.audio_status !== 'ready' ? ` · audio ${esc(it.audio_status)}` : ''}${it.last_played_at ? ' · ✓ heard' : ''}</div>
            ${it.preview ? `<details><summary class="small">Read the words</summary><p class="small">${esc(it.preview)}…</p></details>` : ''}
            ${it.audio_status === 'ready' ? playerHtml(src(it.id)) : ''}
            <div class="row" style="gap:8px;margin-top:8px">${it.approved ? '' : '<button class="btn" data-a="approve">Approve</button>'}${it.rejected_at ? '' : '<button class="btn secondary" data-a="reject">Reject</button>'}</div></div>`).join('')
          : '<p class="muted">Nothing here.</p>'}`;
      wire(el);
      el.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
        const id = b.closest('[data-id]').dataset.id;
        try { await F.family.kapi(child, `/library/${id}/${b.dataset.a}`, { body: {} }); toast(b.dataset.a === 'approve' ? 'Approved ✓' : 'Rejected'); this.render(el, child, rest); }
        catch (e) { toast(e.message); }
      });
    } });
})();
