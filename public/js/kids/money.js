/* Kids: my pocket money — what I have, what I can spend, and my savings jars. Real spending needs a grown-up's yes. */
(function () {
  const { esc, toast, sheet } = F;
  const m = (p) => F.kids.money(p);
  const SOURCE = { opening: 'Saved up', allowance: 'Pocket money', study_reward: 'Learning reward', payout: 'Spent', adjust: 'From a grown-up' };

  function jar(g, size = 64) {
    const pct = g.target_pence ? Math.max(0, Math.min(1, g.saved_pence / g.target_pence)) : Math.min(1, g.saved_pence / 2000);
    const h = Math.round(46 * pct);
    return `<svg viewBox="0 0 44 60" width="${size}" height="${Math.round(size * 60 / 44)}" aria-hidden="true"><rect x="12" y="2" width="20" height="6" rx="2" fill="#c9a26b"/>
      <path d="M8 10 Q4 12 4 20 L4 52 Q4 58 12 58 L32 58 Q40 58 40 52 L40 20 Q40 12 36 10 Z" fill="#e8f4fb" stroke="#9cc3d8" stroke-width="2"/>
      <rect x="6" y="${56 - h}" width="32" height="${h}" rx="4" fill="#f2c14e"/>
      <text x="22" y="38" font-size="15" text-anchor="middle">${pct >= 1 && g.target_pence ? '⭐' : esc(g.icon_emoji || '🐷')}</text></svg>`;
  }

  async function render(el) {
    const d = await F.kids.api('/money');
    const pendingBy = {};
    (d.payouts || []).forEach((p) => { if (p.goal_id && p.status === 'pending') pendingBy[p.goal_id] = p; });
    el.innerHTML = `<div class="kids">${F.kids.header('My money', '🐷')}
      <div class="card kid-card kj-moneyhero center"><div class="muted">You have</div><div class="kj-count">${m(d.total)}</div>
        <div class="kj-split"><div><b>${m(d.spendable)}</b><span>to spend</span></div><div><b>${m(d.earmarked)}</b><span>in jars</span></div></div></div>
      <div class="kj-jars">${d.goals.map((g) => {
        const pend = pendingBy[g.id];
        const full = g.target_pence && g.saved_pence >= g.target_pence;
        return `<div class="card kid-card kj-pot${g.kind === 'long' ? ' long' : ''}" data-g="${g.id}">
          <div class="row">${jar(g)}<div class="grow"><b class="kj-pot-title">${esc(g.title)}</b>
            <div class="muted">${g.target_pence ? `${m(g.saved_pence)} of ${m(g.target_pence)}` : `${m(g.saved_pence)} saved`}</div>
            ${g.target_pence ? `<div class="kj-bar"><div style="width:${g.pct || 0}%"></div></div>` : ''}</div></div>
          ${pend ? '<div class="kj-badge wait">Waiting for a grown-up to say yes 🛒</div>' : `
          <div class="kj-moneybtns">${[[50, '+50p'], [100, '+£1'], [500, '+£5']].map(([p, l]) =>
            `<button class="btn" data-add="${p}" ${d.spendable < p || full ? 'disabled' : ''}>${l}</button>`).join('')}
            ${g.saved_pence > 0 ? '<button class="btn secondary" data-out="1">Take out</button>' : ''}</div>
          ${g.kind !== 'long' && g.funded ? '<button class="btn warm block big" data-buy="1">Ask to buy it 🛒</button>' : ''}
          ${g.kind !== 'long' ? '<button class="btn ghost small" data-del="1">Remove this jar</button>' : ''}`}</div>`;
      }).join('')}</div>
      <div class="card kid-card"><h2>🎯 Save for something new</h2>
        <div class="field"><label for="gn">What do you want?</label><input id="gn" maxlength="60"></div>
        <div class="field"><label for="ga">How much is it? (£)</label><input id="ga" type="number" inputmode="decimal" min="1" max="1000" step="0.5"></div>
        <button class="btn block big" id="addg">Make a jar</button></div>
      ${d.ledger.length ? `<div class="card kid-card"><h2>Money history</h2>${d.ledger.map((l) => `<div class="row kj-hist">
        <span class="grow">${esc(l.note || SOURCE[l.source] || l.source)}</span><b class="${l.pence >= 0 ? 'in' : 'out'}">${l.pence >= 0 ? '+' : '−'}${m(Math.abs(l.pence))}</b></div>`).join('')}</div>` : ''}
    </div>`;

    const act = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); F.kids.celebrate(r); render(el); } catch (e) { toast(e.message === 'nothing_to_add' ? 'Not enough to spend right now' : e.message); } };
    el.querySelectorAll('.kj-pot').forEach((card) => {
      const id = card.dataset.g, g = d.goals.find((x) => x.id === id);
      card.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => { b.disabled = true;
        act(() => F.kids.api(`/money/goals/${id}/allocate`, { body: { pence: +b.dataset.add } }), `🐷 ${m(+b.dataset.add)} into the jar!`); });
      const out = card.querySelector('[data-out]');
      if (out) out.onclick = () => sheet(`<h1>Take money out</h1><p class="muted">From “${esc(g.title)}” back to spending money.</p>
        <div class="kj-moneybtns">${[50, 100, 500].filter((p) => p <= g.saved_pence).map((p) => `<button class="btn secondary big" data-p="${p}">${m(p)}</button>`).join('')}
        <button class="btn secondary big" data-p="${g.saved_pence}">All of it (${m(g.saved_pence)})</button></div>`,
      (sh, close) => sh.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { close(); act(() => F.kids.api(`/money/goals/${id}/withdraw`, { body: { pence: +b.dataset.p } })); }));
      const buy = card.querySelector('[data-buy]');
      if (buy) buy.onclick = () => { buy.disabled = true; act(() => F.kids.api(`/money/goals/${id}/spend-request`, { body: {} }), 'Asked! 🛒'); };
      const del = card.querySelector('[data-del]');
      if (del) del.onclick = () => sheet(`<h1>Remove “${esc(g.title)}”?</h1><p class="muted">Any money in it goes back to your spending money. Nothing is lost.</p>
        <button class="btn block big" id="yes">Yes, remove it</button><button class="btn ghost block" id="no">Keep it</button>`,
      (sh, close) => { sh.querySelector('#no').onclick = close; sh.querySelector('#yes').onclick = () => { close(); act(() => F.kids.api(`/money/goals/${id}`, { method: 'DELETE' })); }; });
    });
    el.querySelector('#addg').onclick = () => {
      const title = el.querySelector('#gn').value.trim(), pounds = parseFloat(el.querySelector('#ga').value);
      if (!title || !(pounds > 0)) { toast('Tell me what it is and how much'); return; }
      act(() => F.kids.api('/money/goals', { body: { title, target_pence: Math.round(pounds * 100) } }), '🎯 New jar!');
    };
  }

  F.kids.register({ id: 'money', emoji: '🐷', name: 'My money', short: 'Money', colour: '#6f9f5c', order: 25, tab: true, render });
})();
