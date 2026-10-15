/* Kids: my "Summer" wish list — things I'd love to do. A grown-up looks at each idea. */
(function () {
  const { esc, toast } = F;
  const BADGE = {
    pending: ['A grown-up will look soon', 'wait'],
    planned: ['We’re going to do this! 🎉', 'yes'],
    done: ['We did it! ✅', 'yes'],
    not_this_time: ['Not this time', 'later'],
    talk_first: ['Let’s talk about this one', 'wait'],
  };

  async function render(el) {
    const d = await F.kids.api('/summer');
    el.innerHTML = `<div class="kids">${F.kids.header('Things I’d love to do', '☀️')}
      <div class="card kid-card"><div class="field"><label for="wi">What would you love to do?</label><input id="wi" maxlength="200" placeholder="A trip, a playdate, an adventure…"></div>
        <button class="btn block big" id="add">Add to my list ✨</button></div>
      ${d.items.map((it) => { const [t, c] = BADGE[it.parent_decision] || BADGE.pending; return `<div class="card kid-card kj-wish">
        <b class="kj-pot-title">${esc(it.title)}</b><div class="kj-badge ${c}">${esc(t)}</div>
        ${it.planned_date && ['planned', 'done'].includes(it.parent_decision) ? `<div class="muted">📅 ${esc(new Date(`${it.planned_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>` : ''}
        ${it.parent_note ? `<div class="small muted">“${esc(it.parent_note)}”</div>` : ''}
        ${it.parent_decision === 'pending' ? `<button class="btn ghost small" data-rm="${it.id}">Changed my mind</button>` : ''}</div>`; }).join('')
        || '<p class="muted center">Nothing yet — what would you love to do?</p>'}</div>`;
    el.querySelector('#add').onclick = async () => {
      const title = el.querySelector('#wi').value.trim();
      if (!title) return;
      try { const r = await F.kids.api('/summer', { body: { title } }); F.kids.celebrate(r); render(el); } catch (e) { toast(e.message); }
    };
    el.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
      try { await F.kids.api(`/summer/${b.dataset.rm}/remove`, { body: {} }); render(el); } catch (e) { toast(e.message); }
    });
  }

  F.kids.register({ id: 'summer', emoji: '☀️', name: 'My wish list', short: 'Wishes', colour: '#f0a04b', order: 30, tab: false, render });
})();
