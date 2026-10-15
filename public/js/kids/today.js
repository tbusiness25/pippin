/* Kids → Today: the morning paper — a fact, a word, a maths warm-up and whatever else arrived this morning.
 * Route: #k/today */
(function () {
  const { esc } = F;
  const title = (k) => String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

  function section(s, v, audioId) {
    if (v == null || v === '') return '';
    let body = '';
    if (typeof v === 'string') body = `<p>${esc(v)}</p>`;
    else if (typeof v === 'object') {
      if (v.headline) body += `<p class="tp-head">${esc(v.headline)}</p>`;
      if (v.body) body += `<p>${esc(v.body)}</p>`;
      if (v.word) body += `<p class="tp-word">${esc(v.word)}</p>`;
      if (v.meaning) body += `<p>${esc(v.meaning)}</p>`;
      if (v.example) body += `<p class="tp-extra">“${esc(v.example)}”</p>`;
      if (v.question) body += `<p class="tp-q">${esc(v.question)}</p>`;
      if (v.answer) body += `<details class="tp-answer"><summary>Show the answer</summary><p>${esc(v.answer)}</p></details>`;
      if (audioId) body += F.kmedia.player(F.kmedia.itemUrl(audioId), { id: audioId });
    }
    if (!body) return '';
    return `<div class="card kid-card tp-section"><h2><span class="tp-emoji">${esc(s.emoji || '📰')}</span>${esc(s.title || title(s.key))}</h2>${body}</div>`;
  }

  async function render(el) {
    const d = await F.kids.api('/today');
    const nice = new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    let html = '';
    if (d.paper && d.paper.content) {
      const c = d.paper.content;
      const known = new Set(d.sections.map((s) => s.key));
      const order = [...d.sections, ...Object.keys(c).filter((k) => !known.has(k)).map((k) => ({ key: k }))];
      html = order.map((s) => section(s, c[s.key], d.audio[s.key])).join('');
    }
    el.innerHTML = `<div class="kids tp">${F.kids.header('Today', '📰')}<p class="tp-date">${esc(nice)}</p>
      ${html || '<div class="card kid-card center"><div style="font-size:3rem">🗞️</div><p>No paper yet today — it usually comes in the morning.</p></div>'}</div>`;
    F.kmedia.wire(el, F.kmedia.played);
  }

  F.kids.register({ id: 'today', emoji: '📰', name: 'Today', colour: '#e0a43a', order: 12, render });
})();
