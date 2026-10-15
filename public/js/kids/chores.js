/* Kids: my jobs (chores). Tick one off → stars + sprig energy. */
(function () {
  const { esc, toast } = F;

  async function render(el) {
    const d = await F.kids.api('/chores');
    const todo = d.chores.filter((c) => !c.completed_today), done = d.chores.filter((c) => c.completed_today);
    el.innerHTML = `<div class="kids">${F.kids.header('My jobs', '⭐')}
      <a class="kj-starbar" href="#k/stars"><span class="kj-bigstar">⭐</span><b>${d.balance}</b><span>stars</span><span class="grow"></span><span class="small">Rewards ›</span></a>
      ${todo.length ? '' : `<div class="card kid-card center kj-alldone"><div style="font-size:3rem">🎉</div><h2>All done today!</h2><p class="muted">Brilliant work. Your sprig is very proud.</p></div>`}
      <div class="kj-list">${[...todo, ...done].map((c) => `
        <button class="kj-chore${c.completed_today ? ' done' : ''}" data-id="${c.id}" ${c.completed_today ? 'disabled' : ''}>
          <span class="kj-ic">${esc(c.icon_emoji || '⭐')}</span>
          <span class="kj-txt"><b>${esc(c.title)}</b>${c.description ? `<span class="small muted">${esc(c.description)}</span>` : ''}</span>
          <span class="kj-stars">${c.completed_today ? '✅' : `+${c.star_value} ⭐`}</span>
        </button>`).join('') || '<p class="muted center">No jobs yet — ask a grown-up to add some.</p>'}</div></div>`;
    el.querySelectorAll('.kj-chore:not(.done)').forEach((b) => b.onclick = async () => {
      b.disabled = true; b.classList.add('ticking');
      try {
        const r = await F.kids.api(`/chores/${b.dataset.id}/complete`, { body: {} });
        if (!r.already_completed) toast(`⭐ +${r.stars_awarded} star${r.stars_awarded === 1 ? '' : 's'}!`);
        F.kids.celebrate(r);
        setTimeout(() => render(el), 450);
      } catch (e) { toast(e.message); b.disabled = false; b.classList.remove('ticking'); }
    });
  }

  F.kids.register({ id: 'chores', emoji: '⭐', name: 'My jobs', short: 'Jobs', colour: '#e8b62c', order: 10, tab: true,
    badge: async () => { const d = await F.kids.api('/chores'); return d.chores.filter((c) => !c.completed_today && c.frequency === 'daily').length || ''; },
    render });
})();
