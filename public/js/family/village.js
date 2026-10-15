/* 🌾 Family → Village: visit the villages the rest of the household has made public. Private ones don't appear. */
(function () {
  const esc = F.esc;
  F.family.section({ id: 'village', emoji: '🌾', name: 'Village', order: 60, render: list });

  async function list(el) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    let d; try { d = await fetch('/api/village/family', { credentials: 'same-origin' }).then((r) => r.json()); } catch { d = null; }
    if (!d || !d.ok) { el.innerHTML = '<p class="muted">Couldn’t load the villages just now.</p>'; return; }
    el.innerHTML = `<div class="card"><h2 style="margin-top:0">🌾 Visit a village</h2>
      <p class="small muted">Only villages that someone has switched to “Family can see” show up here.</p>
      ${d.villages.map((v) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(v.name)}</b>
        <div class="small muted">${v.pet ? `${esc(v.pet.name)} lives here` : 'No sprig yet'}</div></div>
        <button class="btn ghost" data-visit="${esc(v.id)}">Visit</button></div>`).join('') || '<p class="muted small">Nobody has opened their village to the family yet.</p>'}</div>`;
    el.querySelectorAll('[data-visit]').forEach((b) => { b.onclick = () => F.village.open(el, { base: '/api/village', mode: 'visit', uid: b.dataset.visit, back: () => list(el) }); });
  }
})();
