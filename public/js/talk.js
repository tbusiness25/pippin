/* General chat (conversations, optional web search) and Recordings (sorted voice notes). */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const modeSwitch = (on) => `<div class="row" style="margin-bottom:10px"><a class="chip ${on === 'coach' ? 'on' : ''}" href="#coach" style="text-decoration:none">💬 Coach</a><a class="chip ${on === 'chat' ? 'on' : ''}" href="#chat" style="text-decoration:none">✨ Chat</a><a class="chip" href="#voice" style="text-decoration:none">🎙️ Recordings</a></div>`;
  F.modeSwitch = modeSwitch;

  // ---------- general chat ----------
  async function chat(id) {
    F.setTab('coach');
    if (!id) {
      const { threads, web } = await api('/api/chat/threads');
      $app.innerHTML = `${modeSwitch('chat')}<div class="row"><h1 class="grow">Chat</h1><button class="btn" id="new">+ New</button></div>
        <p class="small muted" style="margin-top:4px">Ask anything — writing, ideas, how-to, questions. ${web ? '🌐 Can search the web (search terms leave your network).' : '🔒 Private, no web.'} For planning or how you’re feeling, use Coach.</p>
        <div class="card">${threads.length ? threads.map((t) => `<a class="friend" href="#chat/${t.id}" style="text-decoration:none;color:inherit"><div class="grow"><b>${esc(t.title)}</b><div class="small muted">${new Date(t.updated_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div><span>›</span></a>`).join('') : '<p class="muted">No chats yet.</p>'}</div>`;
      document.getElementById('new').onclick = async () => { const r = await api('/api/chat/threads', { body: {} }); location.hash = `#chat/${r.thread.id}`; };
      return;
    }
    const d = await api(`/api/chat/threads/${id}`);
    $app.innerHTML = `<div class="row"><a href="#chat" class="btn ghost" style="padding-left:0">‹ Chats</a><span class="grow"></span><button class="btn ghost" id="ren">✏️</button><button class="btn ghost" id="del">🗑</button></div>
      <h2 id="ttl">${esc(d.thread.title)}</h2>
      <div class="card"><div class="chat" id="chat" style="max-height:62vh">${d.messages.map((m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? md(m.content) : esc(m.content)}</div>`).join('') || `<p class="muted small">${d.web ? 'Ask anything. I can look things up online.' : 'Ask anything.'}</p>`}</div>
        <div class="row" style="margin-top:10px"><textarea id="say" rows="1" style="min-height:48px" placeholder="Message…"></textarea><button class="btn" id="send">Send</button></div></div>`;
    const box = document.getElementById('chat');
    box.scrollTop = box.scrollHeight;
    const send = async () => {
      const ta = document.getElementById('say'); const text = ta.value.trim(); if (!text) return; ta.value = '';
      box.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(text)}</div><div class="msg assistant typing" id="typing">${d.web ? 'thinking (may search the web)…' : 'thinking…'}</div>`);
      box.scrollTop = box.scrollHeight;
      try {
        const r = await api(`/api/chat/threads/${id}/message`, { body: { text } });
        document.getElementById('typing').outerHTML = `<div class="msg assistant">${md(r.reply)}${r.sources?.length ? `<div class="small muted" style="margin-top:6px">🌐 ${r.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname)}</a>`).join(' · ')}</div>` : ''}</div>${(r.actions || []).map((a) => `<div class="chip small">📥 Added to inbox: ${esc(a.text)}</div>`).join('')}`;
        if (r.crisis) sheet(`<h1>You don’t have to deal with this alone</h1>${r.crisis.resources.map((x) => `<div style="margin:.4em 0"><a href="${esc(x.href)}"><b>${esc(x.name)}</b></a> — ${esc(x.detail)}</div>`).join('')}<button class="btn block" id="ok">OK</button>`, (sh, close) => sh.querySelector('#ok').onclick = close);
        if (r.title) document.getElementById('ttl').textContent = r.title;
      } catch (e) { document.getElementById('typing').outerHTML = `<div class="msg assistant">${esc(e.message)}</div>`; }
      box.scrollTop = box.scrollHeight;
    };
    document.getElementById('send').onclick = send;
    document.getElementById('say').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    document.getElementById('del').onclick = async () => { if (confirm('Delete this chat?')) { await api(`/api/chat/threads/${id}`, { method: 'DELETE' }); location.hash = '#chat'; } };
    document.getElementById('ren').onclick = async () => { const t = prompt('Rename chat', d.thread.title); if (t) { await api(`/api/chat/threads/${id}/rename`, { body: { title: t } }); document.getElementById('ttl').textContent = t; } };
  }

  // ---------- recordings ----------
  const CAT = { kids: ['🧒', 'Kids'], memory: ['💛', 'Memories'], journal: ['📓', 'Journal'], reminder: ['⏰', 'Reminders'], work: ['💼', 'Work'], other: ['🎙️', 'Other'] };
  const actionText = (a) => a.map((x) => x.type === 'plan' ? `⏰ plan: ${x.text}` : x.type === 'inbox' ? `📥 ${x.text}` : x.type === 'journal' ? '📓 saved to journal' : x.type === 'memory' ? '💛 saved as a memory' : '').filter(Boolean);

  async function voice(filter = '') {
    F.setTab('coach');
    const q = filter === 'starred' ? '?starred=1' : filter ? `?category=${filter}` : '';
    const [d, kids] = await Promise.all([api(`/api/voice${q}`), filter ? Promise.resolve(null) : api('/api/voice?category=kids')]);
    const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
    $app.innerHTML = `${modeSwitch('voice')}<h1>Recordings</h1>
      <p class="small muted" style="margin-top:-6px">${d.watching ? 'New voice recordings are sorted automatically every few minutes: reminders and to-dos go to your inbox and plans, memories and kids’ voices are kept with their audio.' : `Voice notes aren’t connected on this ${APP}.`}</p>
      <div class="tabs2"><a class="chip ${!filter ? 'on' : ''}" href="#voice" style="text-decoration:none">All ${total}</a>${Object.entries(CAT).map(([k, [e, n]]) => `<a class="chip ${filter === k ? 'on' : ''}" href="#voice/${k}" style="text-decoration:none">${e} ${n} ${d.counts[k] || 0}</a>`).join('')}<a class="chip ${filter === 'starred' ? 'on' : ''}" href="#voice/starred" style="text-decoration:none">⭐</a></div>
      ${kids && kids.notes.length ? `<div class="card" style="background:linear-gradient(135deg,#fff6e8,#f3f7ef)"><h2>🧒 Kids’ voices</h2><p class="small muted">${kids.notes.length} recordings, kept with their audio for good.</p>
        ${kids.notes.slice(0, 4).map(row).join('')}${kids.notes.length > 4 ? '<a class="btn ghost block" href="#voice/kids">See all</a>' : ''}</div>` : ''}
      <div class="card">${d.notes.length ? d.notes.slice(0, 120).map(row).join('') : '<p class="muted">Nothing here yet.</p>'}</div>`;
    bind();
  }
  function row(n) {
    const acts = actionText(n.actions || []);
    return `<div class="friend" style="align-items:flex-start" data-vn="${n.id}">
      <span style="font-size:1.4rem">${(CAT[n.category] || CAT.other)[0]}</span>
      <div class="grow"><b>${esc(n.title || 'Recording')}</b>${n.starred ? ' ⭐' : ''}
        <div class="small muted">${n.recorded_at ? new Date(n.recorded_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
        ${n.summary ? `<div class="small" style="margin-top:2px">${esc(n.summary.slice(0, 220))}</div>` : ''}
        ${acts.length ? `<div class="small muted" style="margin-top:2px">${acts.map(esc).join(' · ')}</div>` : ''}
        ${n.has_audio ? `<button class="btn ghost small" data-play="${n.id}" style="padding-left:0">▶️ Play${n.kept ? '' : ''}</button>` : ''}<button class="btn ghost small" data-open="${n.id}">Transcript</button></div>
      <button class="btn ghost" data-menu="${n.id}" aria-label="More">⋯</button></div>`;
  }
  function bind() {
    $app.querySelectorAll('[data-play]').forEach((b) => b.onclick = () => {
      const id = b.dataset.play;
      const existing = document.getElementById(`a-${id}`);
      if (existing) { existing.paused ? existing.play() : existing.pause(); return; }
      b.insertAdjacentHTML('afterend', `<audio id="a-${id}" controls autoplay preload="none" src="/api/voice/${id}/audio" style="width:100%;margin-top:6px"></audio>`);
      b.remove();
    });
    $app.querySelectorAll('[data-open]').forEach((b) => b.onclick = async () => {
      const { note } = await api(`/api/voice/${b.dataset.open}`);
      sheet(`<h1>${esc(note.title || 'Recording')}</h1><p class="small muted">${note.recorded_at ? new Date(note.recorded_at).toLocaleString('en-GB') : ''}</p>
        ${note.has_audio ? `<audio controls preload="none" src="/api/voice/${note.id}/audio" style="width:100%"></audio>` : ''}
        <div style="white-space:pre-wrap;margin-top:10px">${esc(note.transcript || 'No transcript.')}</div>`);
    });
    $app.querySelectorAll('[data-menu]').forEach((b) => b.onclick = () => {
      const id = b.dataset.menu;
      sheet(`<h1>Move to…</h1><div class="grid">${Object.entries(CAT).map(([k, [e, n]]) => `<button class="tile" data-mv="${k}" style="min-height:0"><span class="em">${e}</span><b>${n}</b></button>`).join('')}</div>
        <div class="row" style="margin-top:12px"><button class="btn secondary grow" id="star">⭐ Star / unstar</button><button class="btn ghost grow" id="del">Remove</button></div>`, (sh, close) => {
        sh.querySelectorAll('[data-mv]').forEach((x) => x.onclick = async () => { await api(`/api/voice/${id}/category`, { body: { category: x.dataset.mv } }); close(); toast('Moved'); voice(location.hash.split('/')[1] || ''); });
        sh.querySelector('#star').onclick = async () => { await api(`/api/voice/${id}/star`, { body: {} }); close(); voice(location.hash.split('/')[1] || ''); };
        sh.querySelector('#del').onclick = async () => { if (confirm('Remove from this app? (The original note isn’t touched.)')) { await api(`/api/voice/${id}`, { method: 'DELETE' }); close(); voice(location.hash.split('/')[1] || ''); } };
      });
    });
  }

  F.routes.chat = chat;
  F.routes.voice = voice;
})();
