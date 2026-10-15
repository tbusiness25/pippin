/* Kids: my stars and the rewards I'm working towards. Asking never spends — a grown-up decides. */
(function () {
  const { esc, toast } = F;
  const STATUS = {
    pending: ['Asked — a grown-up will look soon', 'wait'],
    talk_first: ['Let’s have a chat about this one', 'wait'],
    approved: ['Yes! Enjoy it when it’s planned 🎉', 'yes'],
  };

  async function render(el) {
    const d = await F.kids.api('/rewards');
    el.innerHTML = `<div class="kids">${F.kids.header('My stars', '🏆')}
      <div class="card kid-card center kj-starhero"><div class="kj-bigstar">⭐</div><div class="kj-count">${d.balance}</div><div class="muted">stars to use</div></div>
      ${d.rewards.map((rw) => {
        const pct = Math.min(100, Math.round((rw.progress / rw.stars_required) * 100));
        const lr = rw.latest_request, st = lr && STATUS[lr.parent_decision];
        return `<div class="card kid-card kj-reward"><div class="row"><span class="kj-ic">${esc(rw.icon_emoji || '🎁')}</span>
            <div class="grow"><b>${esc(rw.title)}</b>${rw.description ? `<div class="small muted">${esc(rw.description)}</div>` : ''}</div></div>
          <div class="kj-bar"><div style="width:${pct}%"></div></div><div class="small muted">${rw.progress} / ${rw.stars_required} ⭐</div>
          ${st ? `<div class="kj-badge ${st[1]}">${esc(st[0])}</div>${lr.parent_note ? `<div class="small muted">“${esc(lr.parent_note)}”</div>` : ''}`
            : `<button class="btn block big" data-ask="${rw.id}" ${rw.can_request ? '' : 'disabled'}>${rw.can_request ? 'Ask a grown-up 🙋' : 'Keep going! 🌱'}</button>`}</div>`;
      }).join('') || '<p class="muted center">No rewards yet.</p>'}</div>`;
    el.querySelectorAll('[data-ask]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { await F.kids.api(`/rewards/${b.dataset.ask}/request`, { body: {} }); toast('Asked! 🙋'); render(el); }
      catch (e) { toast(e.message); b.disabled = false; }
    });
  }

  F.kids.register({ id: 'stars', emoji: '🏆', name: 'Rewards', colour: '#c9774d', order: 20, tab: false, render });
})();
