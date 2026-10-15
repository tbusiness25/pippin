/*
 * Buddy — the child's safe chat friend. Type or tap the mic; Buddy can read its replies aloud.
 * Mic is TAP-to-start / TAP-to-stop (never hold-to-talk: getUserMedia is async, so a quick press used to
 * release before the mic opened and leave the recorder stuck on). A `starting` guard lets a second tap during
 * the permission prompt cancel cleanly; recordings auto-stop at 45 s; recorder errors, leaving the screen,
 * pagehide and visibility changes all release the mic.
 */
(function () {
  const { esc, toast } = F;
  const MAX_RECORD_MS = 45000;
  const IDEAS = [['🤔', 'Tell me a fun fact'], ['🔤', "Let's play a word game"], ['🧩', 'Ask me a riddle'], ['🌈', 'I want to tell you about my day']];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };

  let cleanup = null;   // tears down the current screen (mic, speech, listeners)

  async function render(el) {
    if (cleanup) cleanup();
    const me = F.kids.me || await F.kids.refreshMe();
    const name = (me && me.child && me.child.name) || 'friend';
    el.innerHTML = `<div class="kids buddy">${F.kids.header('Buddy', '🤖')}
      ${me.asParent ? `<div class="card kid-card center"><p>Buddy chats are just for ${esc(name)}.</p>
        <a class="btn block" href="#family/child/${esc(me.child.id)}/buddy">Read ${esc(name)}’s chats</a></div></div>` : `
      <div class="buddy-banner">👀 Your grown-ups can read this chat.</div>
      <div class="buddy-log" id="bLog" aria-live="polite"></div>
      <div class="buddy-typing" id="bTyping" hidden><span></span><span></span><span></span><em id="bTypingText">Buddy is thinking…</em></div>
      <form class="buddy-bar" id="bForm" autocomplete="off">
        <button type="button" class="buddy-mic" id="bMic" aria-pressed="false" aria-label="Tap to talk">🎙️</button>
        <input id="bInput" maxlength="500" placeholder="Tell Buddy something…" enterkeyhint="send" aria-label="Your message">
        <button type="submit" class="buddy-send" id="bSend" aria-label="Send">➤</button>
      </form>
      <div class="buddy-under"><span id="bHint">Tap 🎙️ to talk, tap again when you’re done.</span>
        <button type="button" class="buddy-speak" id="bSpeak" aria-pressed="true"></button></div>`}
    </div>`;
    if (me.asParent) return;

    const $ = (id) => el.querySelector(`#${id}`);
    const log = $('bLog'), input = $('bInput'), send = $('bSend'), mic = $('bMic'), typing = $('bTyping'), typingText = $('bTypingText'), hint = $('bHint');
    let sessionId = null, busy = false, status = { voice: true, tts: false };
    let alive = true;

    // ----- read aloud -----
    const canSpeak = 'speechSynthesis' in window;
    let speakOn = store.get('buddy-speak', 'on') !== 'off';
    const speakBtn = $('bSpeak');
    let audioEl = null;
    function reflectSpeak() { speakBtn.textContent = speakOn ? '🔊 Read aloud: on' : '🔇 Read aloud: off'; speakBtn.setAttribute('aria-pressed', String(speakOn)); }
    speakBtn.onclick = () => { speakOn = !speakOn; store.set('buddy-speak', speakOn ? 'on' : 'off'); if (!speakOn) hush(); reflectSpeak(); };
    function hush() { try { if (canSpeak) speechSynthesis.cancel(); } catch (_) {} if (audioEl) { audioEl.pause(); audioEl = null; } }
    const plain = (t) => String(t || '').replace(/\s*[—–-]*\s*Buddy[!.]?\s*$/i, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, '').trim();
    function deviceSpeak(text) {
      const clean = plain(text);
      if (!canSpeak || !clean) return;
      try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(clean); u.lang = 'en-GB'; u.rate = 0.98; u.pitch = 1.1; speechSynthesis.speak(u); } catch (_) {}
    }
    async function speak(text, id, force) {
      if ((!speakOn && !force) || !text) return;
      hush();
      if (status.tts && id) {
        try {
          const r = await fetch(`/api/kids/buddy/speak/${id}`, { method: 'POST', credentials: 'same-origin' });
          if (r.ok && r.status !== 204) { audioEl = new Audio(URL.createObjectURL(await r.blob())); await audioEl.play(); return; }
        } catch (_) { /* fall back to the device voice */ }
      }
      deviceSpeak(text);
    }
    if (!canSpeak && !status.tts) speakBtn.hidden = true;
    reflectSpeak();

    // ----- messages -----
    function bubble(role, text, opts = {}) {
      const row = document.createElement('div');
      row.className = `buddy-msg ${role}${opts.cls ? ` ${opts.cls}` : ''}`;
      const body = esc(role === 'buddy' ? String(text).replace(/\s*[—–-]*\s*Buddy[!.]?\s*$/i, '').trimEnd() : text).replace(/\n/g, '<br>');
      row.innerHTML = role === 'buddy'
        ? `<span class="buddy-ava" aria-hidden="true">🤖</span><div class="buddy-bubble">${body}<span class="buddy-sig">— Buddy</span>${opts.id ? '<button type="button" class="buddy-replay" aria-label="Read this again">🔊</button>' : ''}</div>`
        : `<div class="buddy-bubble">${body}</div>`;
      if (opts.id) row.querySelector('.buddy-replay').onclick = () => speak(text, opts.id, true);
      log.appendChild(row);
      row.scrollIntoView({ block: 'end', behavior: 'smooth' });
      return row;
    }
    function ideas() {
      const box = document.createElement('div');
      box.className = 'buddy-ideas';
      box.innerHTML = IDEAS.map(([e, t]) => `<button type="button" class="buddy-idea">${e} ${esc(t)}</button>`).join('');
      box.querySelectorAll('button').forEach((b, i) => b.onclick = () => { box.remove(); say(IDEAS[i][1]); });
      log.appendChild(box);
    }
    function setBusy(on, text) {
      busy = on; send.disabled = on; mic.disabled = on && !recording;
      typing.hidden = !on; typingText.textContent = text || 'Buddy is thinking…';
      if (on) typing.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
    async function showReply(r) {
      if (r.sessionId) sessionId = r.sessionId;
      if (r.flagged && !r.blocked) { setBusy(true, 'Buddy is finding a better way to say that…'); await new Promise((ok) => setTimeout(ok, 350)); }
      const text = r.response || 'Hmm, I lost my words!';
      bubble('buddy', text, { id: r.messageId, cls: r.blocked ? 'blocked' : '' });
      speak(text, r.messageId);
      if (r.limits && r.limits.enabled && r.limits.dailyLimit) hint.textContent = `${Math.max(0, r.limits.dailyLimit - (r.limits.usedMinutes || 0))} minutes of Buddy left today`;
      if (r.sprig) F.kids.celebrate(r);
    }
    async function say(text) {
      text = String(text || '').trim();
      if (!text || busy) return;
      el.querySelector('.buddy-ideas')?.remove();
      bubble('me', text);
      setBusy(true);
      try { await showReply(await F.kids.api('/buddy/chat', { body: { message: text, sessionId } })); }
      catch (e) { if (e.message !== 'signed out') bubble('buddy', `Hmm, I couldn’t reach my brain. Try again? (${e.message})`, { cls: 'oops' }); }
      finally { setBusy(false); }
    }
    $('bForm').onsubmit = (e) => { e.preventDefault(); const t = input.value; input.value = ''; say(t); };

    // ----- mic: tap to start, tap to stop -----
    let recorder = null, chunks = [], recording = false, starting = false, cancelStart = false, maxTimer = null, tick = null, stream = null;
    function reflectMic() {
      mic.classList.toggle('recording', recording);
      mic.classList.toggle('starting', starting);
      mic.setAttribute('aria-pressed', String(recording));
      mic.setAttribute('aria-label', recording ? 'Tap to stop' : 'Tap to talk');
      mic.textContent = recording ? '⏹️' : '🎙️';
    }
    function releaseStream() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
    async function startRecording() {
      if (recording || starting || busy) return;
      if (!window.isSecureContext) { bubble('buddy', 'The mic only works on the secure (https) address of this app. You can still type to me!', { cls: 'oops' }); return; }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { bubble('buddy', 'This device can’t record sound — but you can type to me!', { cls: 'oops' }); return; }
      hush();
      starting = true; cancelStart = false; reflectMic();
      let s;
      try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) {
        bubble('buddy', e && e.name === 'NotAllowedError'
          ? 'I need permission to use the mic. Ask a grown-up to tap the padlock by the address and allow the microphone.'
          : 'I couldn’t get to the mic. You can still type to me!', { cls: 'oops' });
        return;
      } finally { starting = false; reflectMic(); }
      if (cancelStart || !alive) { s.getTracks().forEach((t) => t.stop()); return; }   // tapped again while the permission prompt was up
      stream = s;
      try {
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (_) { releaseStream(); bubble('buddy', 'This device can’t record in a way I understand. Try typing?', { cls: 'oops' }); return; }
      chunks = [];
      const rec = recorder;
      rec.addEventListener('dataavailable', (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); });
      rec.addEventListener('stop', () => {
        releaseStream();
        if (!alive) return;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        chunks = [];
        if (blob.size > 256) sendVoice(blob); else bubble('buddy', 'That was a bit too short. Try again?', { cls: 'oops' });
      });
      rec.addEventListener('error', () => { releaseStream(); recording = false; clearTimers(); reflectMic(); bubble('buddy', 'The mic stopped working. Try again?', { cls: 'oops' }); });
      rec.start();
      recording = true; reflectMic();
      const t0 = Date.now();
      hint.textContent = 'Listening… tap ⏹️ when you’re done.';
      tick = setInterval(() => { const left = Math.ceil((MAX_RECORD_MS - (Date.now() - t0)) / 1000); if (left <= 10) hint.textContent = `Listening… ${left}s left`; }, 1000);
      maxTimer = setTimeout(stopRecording, MAX_RECORD_MS);
    }
    function clearTimers() { if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; } if (tick) { clearInterval(tick); tick = null; } hint.textContent = 'Tap 🎙️ to talk, tap again when you’re done.'; }
    function stopRecording() {
      clearTimers();
      if (starting) { cancelStart = true; return; }
      if (!recording || !recorder) return;
      recording = false; reflectMic();
      try { recorder.stop(); } catch (_) { releaseStream(); }
    }
    async function sendVoice(blob) {
      setBusy(true, 'Listening to you…');
      try {
        const r = await fetch(`/api/kids/buddy/voice${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''}`,
          { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.ok === false) { bubble('buddy', d.error || 'I couldn’t hear that. Try again, or type it?', { cls: 'oops' }); return; }
        if (d.transcript) bubble('me', d.transcript, { cls: 'spoken' });
        setBusy(true);
        await showReply(d);
      } catch (_) { bubble('buddy', 'Voice didn’t work that time. Try typing?', { cls: 'oops' }); }
      finally { setBusy(false); }
    }
    mic.addEventListener('click', (e) => { e.preventDefault(); if (recording || starting) stopRecording(); else startRecording(); });
    reflectMic();
    if (!status.voice) mic.hidden = true;

    const onHide = () => stopRecording();
    const onVis = () => { if (document.hidden) { stopRecording(); hush(); } };
    const onHash = () => { if (!location.hash.startsWith('#k/buddy')) cleanup && cleanup(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('hashchange', onHash);
    cleanup = () => {
      alive = false; stopRecording(); releaseStream(); hush();
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('hashchange', onHash);
      cleanup = null;
    };

    // ----- start: pick up a conversation from the last half hour, or say hello -----
    const [st, recent] = await Promise.all([F.kids.api('/buddy/status').catch(() => null), F.kids.api('/buddy/recent').catch(() => null)]);
    if (st) { status = st; mic.hidden = !st.voice; if (!canSpeak && !st.tts) speakBtn.hidden = true; }
    if (recent && recent.messages && recent.messages.length) {
      sessionId = recent.sessionId;
      for (const m of recent.messages) bubble(m.role === 'assistant' ? 'buddy' : 'me', m.content, m.role === 'assistant' ? { id: m.id } : {});
    } else {
      bubble('buddy', `Hi ${name}! I’m Buddy. What’s on your mind today?`);
      ideas();
    }
    if (st && st.limits && st.limits.enabled && !st.limits.ok) { hint.textContent = 'That’s all the Buddy time for today — see you tomorrow!'; }
  }

  F.kids.register({ id: 'buddy', emoji: '💬', name: 'Buddy', short: 'Buddy', colour: '#8ec5e0', order: 70, tab: true, render });
})();
