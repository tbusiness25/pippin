/*
 * Family → child → Typing: their drill scores and the explanations they've typed. Nothing is graded here.
 * (src/kids/typing.js, GET /typing via the parent's ?child= view)
 */
(function () {
  const { esc } = F;
  F.family.childPanel({ id: 'typing', emoji: '⌨️', name: 'Typing', sub: 'Practice scores and his explanations', order: 35, render: panel });

  const when = (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  async function panel(el, child) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const d = await F.family.kapi(child, '/typing');
    const names = Object.fromEntries(d.lessons.map((l) => [l.id, l.name]));
    const drills = d.results.filter((r) => r.kind === 'drill');
    const explains = d.results.filter((r) => r.kind === 'explain');
    el.innerHTML = `<div class="card"><h2 style="margin-top:0">⌨️ Practice</h2>
      ${drills.slice(0, 20).map((r) => `<div class="row small" style="padding:6px 0;border-top:1px solid var(--line)"><div class="grow">${esc(names[r.lesson] || r.lesson)}</div>
        <span>${Math.round(r.wpm)} wpm · ${Math.round(r.accuracy)}%</span><span class="muted" style="margin-left:10px">${when(r.created_at)}</span></div>`).join('') || '<p class="muted small">No practice yet.</p>'}
      </div>
      <div class="card"><h2 style="margin-top:0">✍️ His explanations</h2>
      ${explains.slice(0, 20).map((r) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="small muted">${esc(r.lesson)} · ${when(r.created_at)}</div>
        <p style="white-space:pre-wrap;margin:4px 0 0">${esc(r.body)}</p></div>`).join('') || '<p class="muted small">None yet.</p>'}
      </div>`;
  }
})();
