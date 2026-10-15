/*
 * 🎧 My Yoto — a child's library and players, managed from their own app. (src/kids/yoto.js)
 *   My cards: listen-to-list (play them on the Yoto player), rename, and make new ones.
 *   Make a card: record a few things, or add audio files → one card, one chapter per recording.
 *   Players: the Yoto players on the account and whether they’re online.
 * Playing happens on the Yoto player itself.
 */
(function () {
  const { esc, toast, sheet } = F;
  const K = () => F.kids;
  const MAX = 80 * 1024 * 1024;

  async function render(el, rest) {
    const tab = (rest || 'cards').split('/')[0];
    const tabs = [['cards', '🎧 My cards'], ['make', '🎙 Make a card'], ['players', '🔊 Players']];
    el.innerHTML = `<div class="kids ky">${K().header('My Yoto', '🎧')}
      <div class="kj-tabs">${tabs.map(([k, l]) => `<a class="kj-tab ${k === tab ? 'on' : ''}" href="#k/yoto/${k}">${l}</a>`).join('')}</div>
      <div id="kyBody"><p class="muted center">Loading…</p></div></div>`;
    const body = el.querySelector('#kyBody');
    const st = await K().api('/yoto/status').catch((e) => ({ error: e.message }));
    if (st.error || !st.configured || !st.linked) return notReady(body, st);
    if (tab === 'make') return make(body);
    if (tab === 'players') return players(body);
    return cards(body);
  }

  function notReady(body, st) {
    body.innerHTML = `<div class="card kid-card"><p>${st.linked === false && st.configured ? 'Yoto isn’t connected yet. A grown-up needs to connect it from the Family section.' : 'Yoto isn’t set up on this server yet.'}</p>${st.error ? `<p class="small muted">${esc(st.error)}</p>` : ''}</div>`;
  }

  async function cards(body) {
    const d = await K().api('/yoto/cards');
    body.innerHTML = `<div class="ky-list">${d.cards.map((c) => `<div class="ky-card" data-id="${esc(c.id)}">
      ${c.cover ? `<img src="${esc(c.cover)}" alt="" loading="lazy">` : '<span class="ky-cover">🎧</span>'}
      <div class="grow"><b>${esc(c.title)}</b><div class="small muted">${c.tracks ? `${c.tracks} ${c.tracks === 1 ? 'chapter' : 'chapters'}` : ''}</div></div>
      <button class="btn ghost" data-rename="${esc(c.id)}" data-title="${esc(c.title)}" aria-label="Rename ${esc(c.title)}">✏️</button></div>`).join('') || '<p class="muted center">No cards yet. Make your first one!</p>'}</div>
      <p class="small muted center">To listen, put a card on your Yoto player.</p>`;
    body.querySelectorAll('[data-rename]').forEach((b) => { b.onclick = () => rename(b.dataset.rename, b.dataset.title, body); });
  }

  function rename(id, title, body) {
    sheet(`<h1>Rename</h1><input id="kyName" value="${esc(title)}" maxlength="120" style="margin:8px 0">
      <button class="btn block" id="kyOk">Save</button>`, (el, close) => {
      el.querySelector('#kyOk').onclick = async () => {
        try { await K().api(`/yoto/cards/${encodeURIComponent(id)}/rename`, { body: { title: el.querySelector('#kyName').value } }); close(); toast('Renamed'); cards(body); }
        catch (e) { toast(e.message); }
      };
    });
  }

  // ---------------------------------------------------------------- make a card
  async function make(body) {
    const state = { picked: [] };     // { id, name, status, job }
    body.innerHTML = `<p>Record a few things (like telling a story, or playing a tune on an instrument), or add audio files. Each one becomes a chapter.</p>
      <div class="ky-actions"><button class="btn block big" id="kyRec">🎙 Record something</button>
        <label class="btn secondary block big">🎧 Add an audio file<input type="file" id="kyFile" accept="audio/*" hidden></label></div>
      <div id="kyParts"></div>
      <label class="fld"><span class="small muted">What’s the card called?</span><input id="kyTitle" maxlength="120" placeholder="e.g. My song"></label>
      <button class="btn block big" id="kyMake" disabled>Make my card</button>`;
    const parts = body.querySelector('#kyParts');
    const draw = () => {
      parts.innerHTML = state.picked.map((p, i) => `<div class="ky-part"><span class="ky-n">${i + 1}</span><div class="grow">${esc(p.name)}</div>
        <span class="small ${p.status === 'ready' ? 'ok' : p.status === 'failed' ? 'bad' : 'muted'}">${p.status === 'ready' ? '✓ ready' : p.status === 'failed' ? esc(p.error || 'problem') : 'getting ready…'}</span>
        <button class="ghost" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('');
      parts.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { state.picked.splice(+b.dataset.rm, 1); draw(); }; });
      body.querySelector('#kyMake').disabled = !state.picked.length || state.picked.some((p) => p.status !== 'ready') || !body.querySelector('#kyTitle').value.trim();
    };
    const send = async (blob, name) => {
      const part = { name, status: 'uploading' }; state.picked.push(part); draw();
      try {
        const r = await fetch(`/api/kids/yoto/tracks?title=${encodeURIComponent(name)}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'audio/mpeg' }, credentials: 'same-origin' });
        const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Upload failed');
        part.job = j.job; part.status = 'working'; draw(); poll(part);
      } catch (e) { part.status = 'failed'; part.error = e.message; draw(); }
    };
    const poll = async (part) => {
      for (let i = 0; i < 180 && part.status === 'working'; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        if (!body.isConnected) return;
        const d = await K().api('/yoto/jobs').catch(() => null);
        const j = d && d.jobs.find((x) => x.id === part.job);
        if (j && j.status === 'ready') { part.status = 'ready'; draw(); return; }
        if (j && j.status === 'failed') { part.status = 'failed'; part.error = j.error || 'could not prepare it'; draw(); return; }
      }
      if (part.status === 'working') { part.status = 'failed'; part.error = 'still going — try again later'; draw(); }
    };
    body.querySelector('#kyFile').onchange = (e) => { for (const f of e.target.files) { if (f.size > MAX) toast(`${f.name} is too big`); else send(f, f.name.replace(/\.[^.]+$/, '')); } e.target.value = ''; };
    body.querySelector('#kyTitle').oninput = draw;
    body.querySelector('#kyRec').onclick = () => recordSheet((blob, name) => send(blob, name));
    body.querySelector('#kyMake').onclick = async () => {
      const b = body.querySelector('#kyMake'); b.disabled = true; b.textContent = 'Making your card…';
      try {
        const r = await K().api('/yoto/cards', { body: { title: body.querySelector('#kyTitle').value, job_ids: state.picked.map((p) => p.job) } });
        toast('Your card is ready! 🎉'); body.innerHTML = `<div class="card kid-card center"><div style="font-size:3rem">🎧</div><h2>${esc(body.querySelector('#kyTitle').value)}</h2>
          <p>Put it on your Yoto player to listen.</p><a class="btn block" href="#k/yoto/cards">See my cards</a></div>`;
      } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Make my card'; }
    };
    draw();
  }

  /** Tap to start, tap to stop. Up to 3 minutes per recording. */
  function recordSheet(done) {
    sheet(`<h1>🎙 Record</h1><p class="muted">Tap start, and tap stop when you’re finished.</p>
      <div class="bigtime" id="kyT">0:00</div><button class="btn block big" id="kyGo">🎤 Start</button>`, (el, close) => {
      let rec = null, chunks = [], started = 0, timer = null, stream = null, busy = false;
      const go = el.querySelector('#kyGo');
      const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); clearInterval(timer); };
      go.onclick = async () => {
        if (rec && rec.state === 'recording') return stop();
        if (busy) return; busy = true;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch { busy = false; return toast('Ask a grown-up to allow the microphone'); }
        busy = false; chunks = [];
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
        rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
          close();
          done(blob, `Recording ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
        };
        rec.start(); started = Date.now(); go.textContent = '■ Stop';
        timer = setInterval(() => { const s = (Date.now() - started) / 1000; el.querySelector('#kyT').textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; if (s >= 180) stop(); }, 250);
      };
    });
  }

  async function players(body) {
    const d = await K().api('/yoto/devices');
    body.innerHTML = `<div class="ky-list">${d.devices.map((p) => `<div class="ky-card"><span class="ky-cover">🔊</span><div class="grow"><b>${esc(p.name)}</b>
      <div class="small ${p.online ? 'ok' : 'muted'}">${p.online ? '● online' : '○ offline'}${p.family ? ` · ${esc(p.family)}` : ''}</div></div></div>`).join('') || '<p class="muted center">No players found on the account.</p>'}</div>
      <p class="small muted center">Pressing play, pausing and skipping happen on the Yoto player itself.</p>`;
  }

  F.kids.register({ id: 'yoto', emoji: '🎧', name: 'My Yoto', colour: '#f2c14e', order: 25, render });
})();
