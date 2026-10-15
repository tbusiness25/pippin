/*
 * Explore → 📰 Digest: a few picked articles a day, written by an external workflow through the hooks API.
 * The tile shows for people who have any digests (users.settings.fam_digest).
 */
(function () {
  const { api, esc } = F;
  const $app = document.getElementById('app');
  const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

  async function page() {
    F.setTab('explore');
    $app.innerHTML = '<a href="#explore" class="btn ghost" style="padding-left:0">‹ Explore</a><h1>📰 Digest</h1><p class="muted">Loading…</p>';
    let digests;
    try { ({ digests } = await api('/api/family/digest/recent?days=60')); }
    catch (e) { $app.querySelector('p').textContent = e.message; return; }
    $app.innerHTML = `<a href="#explore" class="btn ghost" style="padding-left:0">‹ Explore</a><h1>📰 Digest</h1>
      ${digests.length ? digests.map((d, i) => `<details class="card dg-day" ${i === 0 ? 'open' : ''}><summary><b>${esc(day(d.digest_date))}</b>
        <span class="small muted"> · ${(d.picks || []).length} pick${(d.picks || []).length === 1 ? '' : 's'}</span></summary>
        ${(d.picks || []).map((p) => { const url = safeUrl(p.url); const why = p.why || p.why_it_matters; return `<div class="dg-pick">
          ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><b>${esc(p.title)}</b> ↗</a>` : `<b>${esc(p.title)}</b>`}
          <div class="small muted">${[p.source, p.read_minutes ? `~${p.read_minutes} min` : ''].filter(Boolean).map(esc).join(' · ')}</div>
          ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}${why ? `<p class="small"><i>Why: ${esc(why)}</i></p>` : ''}</div>`; }).join('')}</details>`).join('')
    : '<div class="card"><p>No digests in the last two months.</p><p class="small muted">They’re written by an outside workflow through this server’s hooks API — see src/family/digest.js.</p></div>'}`;
  }

  F.routes.digest = page;
  F.explore.tile({ href: '#digest', emoji: '📰', name: 'Digest', sub: 'A few good reads a day',
    show: (s) => s.user && s.user.role === 'adult' && !!(s.user.settings || {}).fam_digest });
})();
