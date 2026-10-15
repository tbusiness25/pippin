/*
 * Talk → Agent: chat with your own agent (users.brain). Streams replies, keeps conversations (the agent's own
 * sessions when it has them), shows tool activity in one quiet line, and does voice: 🎙️ dictate, 🔊 read aloud,
 * and a hands-free voice mode (talk → it answers out loud → listens again).
 */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const md = (t) => esc(t).replace(/```([\s\S]*?)```/g, '<pre>$1</pre>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s+(.+)$/gm, '<b>$1</b>').replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const TOOL_NAMES = { terminal: 'using the terminal', web_search: 'searching the web', browser: 'browsing', read_file: 'reading files', memory: 'checking memory',
    skill_view: 'reading a skill', kanban: 'checking tasks', homeassistant: 'checking the house', _thinking: 'thinking' };
  const toolText = (n) => TOOL_NAMES[n] || TOOL_NAMES[String(n).split(/[._]/)[0]] || `using ${String(n).replace(/_/g, ' ')}`;

  // ---------- streaming ----------
  async function stream(id, text, on) {
    const r = await fetch(`/api/agent/threads/${encodeURIComponent(id)}/message`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (r.status === 401) { location.hash = '#login'; throw new Error('signed out'); }
    if (!r.ok || !r.body) throw new Error('Your agent didn’t answer — try again.');
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, i); buf = buf.slice(i + 2);
        let ev = 'message', data = '';
        for (const line of frame.split('\n')) { if (line.startsWith('event:')) ev = line.slice(6).trim(); else if (line.startsWith('data:')) data += line.slice(5).trim(); }
        if (!data) continue;
        let d = {}; try { d = JSON.parse(data); } catch (_) { continue; }
        on(ev, d);
      }
    }
  }

  // ---------- voice ----------
  let rec = null;
  async function record({ autoStop = false } = {}) {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const mr = new MediaRecorder(mediaStream);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((resolve) => { mr.onstop = () => { mediaStream.getTracks().forEach((t) => t.stop()); resolve(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); }; });
    mr.start();
    let stopTimer = setTimeout(() => mr.state !== 'inactive' && mr.stop(), 60000);
    if (autoStop) {   // hands-free: stop after ~1.4 s of quiet once you've started speaking
      const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(mediaStream); const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Uint8Array(an.fftSize); let spoke = false, quietSince = 0;
      const tick = () => {
        if (mr.state === 'inactive') { ctx.close(); return; }
        an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) sum += (v - 128) ** 2;
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 6) { spoke = true; quietSince = 0; } else if (spoke) { quietSince = quietSince || Date.now(); if (Date.now() - quietSince > 1400) { mr.stop(); return; } }
        requestAnimationFrame(tick);
      };
      tick();
    }
    rec = { stop: () => { clearTimeout(stopTimer); if (mr.state !== 'inactive') mr.stop(); }, done };
    return rec;
  }
  async function transcribe(blob) {
    const r = await fetch('/api/agent/transcribe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Couldn’t hear that');
    return d.text || '';
  }
  let audioEl = null;
  async function speak(text) {
    const r = await api('/api/coach/speak', { body: { text: text.slice(0, 1800) } }).catch(() => null);
    if (!r?.audio) return;
    if (audioEl) audioEl.pause();
    audioEl = new Audio(`data:audio/mp3;base64,${r.audio}`);
    await new Promise((res) => { audioEl.onended = res; audioEl.onerror = res; audioEl.play().catch(res); });
  }

  // ---------- list ----------
  async function list() {
    F.setTab('coach');
    const { threads, label } = await api('/api/agent/threads');
    $app.innerHTML = `${F.modeSwitch('agent')}<div class="row"><h1 class="grow">${esc(label)}</h1><button class="btn" id="new">+ New</button></div>
      <p class="small muted" style="margin-top:4px">Your own ${esc(label)} — with its tools and memory. Conversations from its other apps show here too.</p>
      <div class="card">${threads.length ? threads.map((t) => `<a class="friend" href="#agent/${encodeURIComponent(t.id)}" style="text-decoration:none;color:inherit"><div class="grow"><b>${esc(t.title)}</b>
        <div class="small muted">${when(t.updated_at)}${t.source ? ` · ${esc(t.source)}` : ''}</div></div><span>›</span></a>`).join('') : '<p class="muted">No conversations yet.</p>'}</div>`;
    document.getElementById('new').onclick = async () => { const r = await api('/api/agent/threads', { body: {} }); location.hash = `#agent/${encodeURIComponent(r.thread.id)}`; };
  }

  // ---------- conversation ----------
  async function convo(id) {
    F.setTab('coach');
    const d = await api(`/api/agent/threads/${encodeURIComponent(id)}`);
    const info = await api('/api/agent/info').catch(() => ({}));
    const bubble = (m) => m.role === 'tool' ? `<div class="msg tool small muted">⚙️ ${esc(toolText(m.content))}</div>`
      : `<div class="msg ${m.role}">${m.role === 'assistant' ? md(m.content) : esc(m.content)}${m.role === 'assistant' && info.speak ? '<button class="btn ghost small say" aria-label="Read aloud">🔊</button>' : ''}</div>`;
    $app.innerHTML = `<div class="row"><a href="#agent" class="btn ghost" style="padding-left:0">‹ ${esc(d.label)}</a><span class="grow"></span>
        ${info.voice ? '<button class="btn ghost" id="vm" title="Hands-free voice">🗣️</button>' : ''}<button class="btn ghost" id="ren">✏️</button><button class="btn ghost" id="del">🗑</button></div>
      <h2 id="ttl">${esc(d.thread.title)}</h2>
      <div class="card"><div class="chat" id="chat" style="max-height:62vh">${d.messages.map(bubble).join('') || '<p class="muted small">Ask anything.</p>'}</div>
        <div class="row" style="margin-top:10px">${info.voice ? '<button class="btn secondary" id="mic" aria-label="Dictate">🎙️</button>' : ''}<textarea id="say" rows="1" style="min-height:48px" placeholder="Message…"></textarea><button class="btn" id="send">Send</button></div></div>`;
    const box = document.getElementById('chat');
    box.scrollTop = box.scrollHeight;
    const bindSay = () => box.querySelectorAll('.say').forEach((b) => b.onclick = () => { b.disabled = true; speak(b.parentElement.innerText.replace('🔊', '')).finally(() => { b.disabled = false; }); });
    bindSay();
    let busy = false;

    async function send(text, { voice = false } = {}) {
      if (!text || busy) return null;
      busy = true;
      box.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(text)}</div><div class="msg tool small muted" id="act">thinking…</div><div class="msg assistant" id="live"></div>`);
      box.scrollTop = box.scrollHeight;
      const live = document.getElementById('live'), act = document.getElementById('act');
      let full = '', final = null;
      try {
        await stream(id, text, (ev, x) => {
          if (ev === 'delta') { full += x.text; live.innerHTML = md(full); if (act) act.textContent = ''; }
          else if (ev === 'tool') { if (act) act.textContent = `⚙️ ${toolText(x.name)}${x.phase === 'failed' ? ' (didn’t work)' : '…'}`; }
          else if (ev === 'done') { final = x.text; if (x.title) document.getElementById('ttl').textContent = x.title; }
          else if (ev === 'error') throw new Error(x.message);
          box.scrollTop = box.scrollHeight;
        });
        live.innerHTML = md(final || full) + (info.speak ? '<button class="btn ghost small say" aria-label="Read aloud">🔊</button>' : '');
        live.removeAttribute('id'); act?.remove(); bindSay();
      } catch (e) { live.innerHTML = esc(e.message); live.removeAttribute('id'); act?.remove(); }
      busy = false;
      box.scrollTop = box.scrollHeight;
      return final || full;
    }
    const sendTyped = () => { const ta = document.getElementById('say'); const t = ta.value.trim(); ta.value = ''; send(t); };
    document.getElementById('send').onclick = sendTyped;
    document.getElementById('say').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTyped(); } });

    // Dictate into the box (tap to start, tap to stop).
    const mic = document.getElementById('mic');
    if (mic) mic.onclick = async () => {
      if (rec) { rec.stop(); return; }
      try {
        mic.textContent = '⏹️'; mic.classList.add('warm');
        const r = await record();
        const blob = await r.done; rec = null; mic.textContent = '⏳';
        const t = await transcribe(blob);
        const ta = document.getElementById('say'); ta.value = (ta.value ? `${ta.value} ` : '') + t; ta.focus();
      } catch (e) { toast(e.message.includes('Permission') ? 'Microphone blocked — allow it in your browser' : e.message); }
      rec = null; mic.textContent = '🎙️'; mic.classList.remove('warm');
    };

    // Hands-free: listen → send → read the answer aloud → listen again, until you tap stop.
    const vm = document.getElementById('vm');
    if (vm) vm.onclick = () => {
      let on = true;
      const close = sheet(`<div class="center"><div id="vmOrb" class="breath" style="margin:10px auto">🎙️</div><h2 id="vmS">Listening…</h2>
        <p class="small muted" id="vmT"></p><button class="btn block" id="vmStop">Stop</button></div>`, (sh, cl) => {
        sh.querySelector('#vmStop').onclick = () => { on = false; rec?.stop(); audioEl?.pause(); cl(); };
      });
      const S = (t) => { const el = document.getElementById('vmS'); if (el) el.textContent = t; };
      (async () => {
        while (on && document.getElementById('vmS')) {
          try {
            S('Listening…'); const r = await record({ autoStop: true }); const blob = await r.done; rec = null;
            if (!on) break;
            S('Hearing you…'); const t = await transcribe(blob);
            if (!t || t.length < 2) continue;
            document.getElementById('vmT').textContent = `“${t}”`;
            S('Thinking…'); const ans = await send(t, { voice: true });
            if (!on || !ans) continue;
            S('Speaking…'); await speak(ans);
          } catch (e) { toast(e.message); on = false; }
        }
        if (document.getElementById('vmS')) close();
      })();
    };

    document.getElementById('del').onclick = async () => { if (confirm('Delete this conversation?')) { await api(`/api/agent/threads/${encodeURIComponent(id)}`, { method: 'DELETE' }); location.hash = '#agent'; } };
    document.getElementById('ren').onclick = async () => { const t = prompt('Rename', d.thread.title); if (t) { await api(`/api/agent/threads/${encodeURIComponent(id)}/rename`, { body: { title: t } }); document.getElementById('ttl').textContent = t; } };
  }

  F.routes.agent = (rest) => (rest ? convo(decodeURIComponent(rest)) : list());
})();
