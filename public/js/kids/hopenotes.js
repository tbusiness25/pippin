/* 💬 Messages: a thread with the grown-ups. Write (emoji welcome) or record a voice note; they answer in the same thread. */
(function () {
  const esc = F.esc;
  const EMOJI = ['😀', '😂', '🥰', '❤️', '👍', '🎉', '⭐', '🌙', '😴', '🦖', '⚽', '🎸', '🧱', '🐶', '🍕', '🙏'];
  const when = (s) => new Date(s).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  async function render(el) {
    let d; try { d = await F.kids.api('/notes'); } catch (e) { el.innerHTML = `<p>${esc(e.message)}</p>`; return; }
    const viewing = !!F.kids.viewingChild;
    el.innerHTML = `<div class="card kn-card"><h2 style="margin-top:0">💬 Chat with Mum &amp; Dad</h2>
      <div class="kn-thread" id="knThread">${d.messages.map(bubble).join('') || '<p class="muted center small">Nothing yet. Say hello! 👋</p>'}</div>
      ${viewing ? '<p class="small muted">Notes are written from the child’s own app.</p>' : `
      <div class="kn-emoji" aria-label="Emoji">${EMOJI.map((e) => `<button type="button" data-em="${e}">${e}</button>`).join('')}</div>
      <textarea id="knText" rows="2" maxlength="1000" placeholder="Write to Mum and Dad…" aria-label="Your message"></textarea>
      <div class="row"><button class="btn block" id="knSend" style="min-height:52px">Send 💬</button></div>
      <button class="btn secondary block" id="knRec" style="min-height:52px;margin-top:8px">🎙 Record a voice note</button>
      <div id="knPreview"></div>`}
    </div>`;

    const thread = el.querySelector('#knThread'); if (thread) thread.scrollTop = thread.scrollHeight;
    if (!viewing) composer(el);
  }

  const bubble = (m, qs = '') => {
    const mine = m.sender === 'child';
    const who = mine ? '' : `<div class="kn-who">${esc(m.parent_name || 'Mum or Dad')}</div>`;
    const body = m.kind === 'voice' ? (m.has_audio ? `<audio controls preload="none" src="/api/kids/notes/${m.id}/audio${qs}"></audio>` : '🎙 voice note') : esc(m.body);
    return `<div class="kn-msg ${mine ? 'mine' : 'theirs'}">${who}<div class="kn-bubble">${body}</div>
      <div class="kn-time">${when(m.created_at)}${mine && m.read_at ? ' · seen' : ''}</div></div>`;
  };

  function composer(el) {
    const ta = el.querySelector('#knText');
    el.querySelectorAll('[data-em]').forEach((b) => { b.onclick = () => {
      const s = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, s) + b.dataset.em + ta.value.slice(ta.selectionEnd ?? s);
      ta.focus(); ta.setSelectionRange(s + b.dataset.em.length, s + b.dataset.em.length);
    }; });
    el.querySelector('#knSend').onclick = async (ev) => {
      const text = ta.value.trim(); if (!text) return F.toast('Write something first');
      ev.currentTarget.disabled = true;
      try { await F.kids.api('/notes/text', { body: { text } }); F.toast('Sent! 💬'); render(el); }
      catch (e) { F.toast(e.message); ev.currentTarget.disabled = false; }
    };
    recordInto(el.querySelector('#knRec'), (blob, secs) => {
      const pv = el.querySelector('#knPreview');
      pv.innerHTML = `<audio controls src="${URL.createObjectURL(blob)}" style="width:100%;margin-top:10px"></audio>
        <div class="row" style="margin-top:8px"><button class="btn block" id="knSendVoice" style="min-height:52px">🎙 Send it</button><button class="btn ghost" id="knScrap">Scrap</button></div>`;
      pv.querySelector('#knScrap').onclick = () => { pv.innerHTML = ''; };
      pv.querySelector('#knSendVoice').onclick = async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          const r = await fetch(`/api/kids/notes/voice?seconds=${secs}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'audio/webm' }, credentials: 'same-origin' });
          const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Didn’t send');
          F.toast('Sent! 🎙'); render(el);
        } catch (e) { F.toast(e.message); ev.currentTarget.disabled = false; }
      };
    });
  }

  /** Tap to start, tap to stop (up to 3 minutes). Calls done(blob, seconds). */
  function recordInto(btn, done) {
    let rec = null, chunks = [], started = 0, timer = null, stream = null, starting = false;
    const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); clearInterval(timer); };
    btn.onclick = async () => {
      if (rec && rec.state === 'recording') return stop();
      if (starting) return; starting = true;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { starting = false; return F.toast('Ask a grown-up to allow the microphone'); }
      starting = false; chunks = [];
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop()); clearInterval(timer);
        btn.textContent = '🎙 Record a voice note';
        done(new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] }), Math.max(1, Math.round((Date.now() - started) / 1000)));
      };
      rec.start(); started = Date.now(); btn.textContent = '■ Stop';
      timer = setInterval(() => { if ((Date.now() - started) / 1000 >= 180) stop(); }, 500);
    };
  }

  F.kids.register({ id: 'hopenotes', emoji: '💬', name: 'Messages', colour: '#e07a8a', order: 40, render });
})();
