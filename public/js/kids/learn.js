/* Kids → Learn: short modules about brains, feelings, kindness and wonders. Read one, have a think, tap
 * "I finished!" — that earns a little pocket money the first time (and makes the sprig happy).
 * Routes: #k/learn · #k/learn/<slug> */
(function () {
  const { esc, toast } = F;
  const money = (p) => (F.kids.money ? F.kids.money(p) : `${p}p`);

  function block(b) {
    if (!b || typeof b !== 'object') return '';
    const t = esc(b.value || b.text || b.question || '');
    switch (b.type) {
      case 'text': return `<p class="ln-text">${t}</p>`;
      case 'illustration': return /^https?:\/\//.test(b.src || '') ? `<img class="ln-hero" src="${esc(b.src)}" alt="${esc(b.alt || '')}">` : '';
      case 'analogy': return `<div class="ln-analogy">${t}</div>`;
      case 'question': return `<div class="ln-question"><p class="ln-q">${t}</p>${b.answer ? `<details><summary>Show an idea</summary><p>${esc(b.answer)}</p></details>` : ''}</div>`;
      case 'tryit': return `<div class="ln-tryit"><div class="ln-label">${esc(b.label || 'Try it')}</div><p>${t}</p></div>`;
      case 'talk': return `<div class="ln-talk"><div class="ln-label">Talk about it</div><p>${t}</p></div>`;
      default: return t ? `<p class="ln-text">${t}</p>` : '';
    }
  }
  F.klearnBlock = block;   // shared with the parents' draft review

  async function hub(el) {
    const d = await F.kids.api('/learn');
    const metas = d.topic_meta.filter((t) => (d.topics[t.id] || []).length);
    const other = Object.keys(d.topics).filter((k) => !d.topic_meta.some((t) => t.id === k)).map((k) => ({ id: k, title: k, emoji: '✨' }));
    const all = [...metas, ...other];
    el.innerHTML = `<div class="kids ln">${F.kids.header('Learn', '🧠')}
      ${d.reward_pence ? `<p class="muted">Finish a module to earn ${esc(money(d.reward_pence))} pocket money (once each).</p>` : ''}
      ${all.length ? all.map((t) => `<h2 class="ln-topic">${esc(t.emoji)} ${esc(t.title)}</h2><div class="ln-cards">${d.topics[t.id].map((m) =>
        `<a class="ln-card ${m.completed ? 'done' : m.explored ? 'seen' : ''}" href="#k/learn/${encodeURIComponent(m.slug)}">
          <span class="ln-card-hero">${m.illustration_url ? `<img src="${esc(F.kmedia.withChild(m.illustration_url))}" alt="" loading="lazy">` : esc(t.emoji)}</span>
          <b>${esc(m.title)}</b><span class="ln-card-state">${m.completed ? '🪙 Finished' : m.explored ? '✓ Peeked' : 'New'}</span></a>`).join('')}</div>`).join('')
        : '<div class="card kid-card center"><div style="font-size:3rem">🔭</div><p>New things to explore are coming soon.</p></div>'}</div>`;
  }

  async function reader(el, slug) {
    const d = await F.kids.api(`/learn/${encodeURIComponent(slug)}`);
    const m = d.module;
    el.innerHTML = `<div class="kids ln">${F.kids.header(m.title, '', '#k/learn')}
      ${m.audio_url ? `<div class="card kid-card"><b>🔊 Listen to it</b>${F.kmedia.player(F.kmedia.withChild(m.audio_url))}</div>` : ''}
      ${m.illustration_url ? `<img class="ln-hero" src="${esc(F.kmedia.withChild(m.illustration_url))}" alt="">` : ''}
      <div class="card kid-card ln-body">${(Array.isArray(m.body) ? m.body : []).map(block).join('')}</div>
      <div id="ln-finish">${finishHtml(m, d.reward_pence)}</div></div>`;
    F.kmedia.wire(el);
    F.kids.api(`/learn/${encodeURIComponent(slug)}/explored`, { body: {} }).catch(() => {});
    wireFinish(el, m, d.reward_pence);
  }
  function finishHtml(m, pence) {
    if (m.completed) return '<div class="card kid-card center ln-done">🪙 You finished this one — brilliant!</div>';
    return `<div class="card kid-card center"><p>Read it all and had a think?</p>
      <button class="btn block big kid-big-btn" id="ln-go">I finished!${pence ? ` Earn ${esc(money(pence))}` : ''}</button></div>`;
  }
  function wireFinish(el, m, pence) {
    const b = el.querySelector('#ln-go');
    if (!b) return;
    if (F.kids.me && F.kids.me.asParent) { b.disabled = true; b.textContent = 'Only the child can finish it'; return; }
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Saving…';
      try {
        const r = await F.kids.api(`/learn/${encodeURIComponent(m.slug)}/complete`, { body: {} });
        el.querySelector('#ln-finish').innerHTML = `<div class="card kid-card center ln-done">${r.rewarded ? `🎉 Well done! You earned ${esc(money(r.pence))} pocket money!` : '🌟 Well done — you finished it!'}</div>`;
        F.kids.celebrate(r);
      } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Try again'; }
    };
  }

  F.kids.register({ id: 'learn', emoji: '🧠', name: 'Learn', colour: '#3fa39a', order: 35,
    render: (el, rest) => (rest ? reader(el, decodeURIComponent(rest)) : hub(el)) });
})();
