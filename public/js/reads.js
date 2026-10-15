/* Reads: articles the server owner drops into READS_DIR as Markdown, with optional audio. */
(function () {
  const { api, esc } = F;
  const $app = document.getElementById('app');

  // Small, safe Markdown: everything is escaped first, then a few patterns are turned into tags.
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  function render(md) {
    const out = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`</${list}>`); list = null; };
    for (const raw of md.split('\n')) {
      const line = raw.trim();
      let m;
      if (!line) { flushPara(); flushList(); continue; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        flushPara(); flushList();
        const lvl = Math.min(m[1].length + 1, 3); // the page already has an h1
        out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      } else if ((m = line.match(/^(?:[-*]|(\d+)\.)\s+(.*)$/))) {
        flushPara();
        const kind = m[1] ? 'ol' : 'ul';
        if (list !== kind) { flushList(); out.push(`<${kind} class="reads-list">`); list = kind; }
        out.push(`<li>${inline(m[2])}</li>`);
      } else { flushList(); para.push(line); }
    }
    flushPara(); flushList();
    return out.join('');
  }

  async function shelf() {
    F.setTab('explore');
    const { reads } = await api('/api/reads');
    $app.innerHTML = `<a href="#explore" class="btn ghost" style="padding-left:0">‹ Explore</a><h1>Reads</h1>
      ${reads.length ? reads.map((r) => `<a class="card row" href="#reads/${r.slug}" style="text-decoration:none;color:inherit">
        <div class="grow"><b>${esc(r.title)}</b>${r.subtitle ? `<div class="small muted">${esc(r.subtitle)}</div>` : ''}
        <div class="small">${r.minutes} min read${r.audio ? ' · 🎧 listen' : ''}</div></div><span>›</span></a>`).join('')
      : '<div class="card"><p>Nothing here yet.</p><p class="small muted">Put Markdown files in the server’s <code>data/reads</code> folder (or <code>READS_DIR</code>). An audio file with the same name, such as <code>my-article.mp3</code>, adds a Listen button.</p></div>'}`;
  }

  async function article(slug) {
    F.setTab('explore');
    const r = await api(`/api/reads/${encodeURIComponent(slug)}`);
    // The title and subtitle are shown in the header, so drop them from the body.
    const body = r.md.replace(/^\s*#\s+.*\n/, '').replace(/^\s*\*[^*].*\*\s*\n/, '');
    $app.innerHTML = `<a href="#reads" class="btn ghost" style="padding-left:0">‹ Reads</a>
      <h1>${esc(r.title)}</h1>${r.subtitle ? `<p class="muted">${esc(r.subtitle)}</p>` : ''}
      ${r.audio ? `<div class="card"><b>🎧 Listen</b><audio controls preload="none" style="width:100%;margin-top:8px" src="/api/reads/${encodeURIComponent(slug)}/audio"></audio></div>` : ''}
      <article class="card reads-body">${render(body)}</article>`;
  }

  F.routes.reads = (rest) => {
    return rest ? article(rest) : shelf();
  };
})();
