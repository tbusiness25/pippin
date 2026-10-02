/* The private coach: guided flows, chat, voice, plans/memories as chips, crisis card. */
(function () {
  const { api, esc, toast } = F;
  const $app = document.getElementById('app');
  let info = null, speakReplies = false, rec = null, recStarting = false, audioEl = null;
  try { speakReplies = localStorage.getItem('finch-speak') === '1'; } catch (_) {}
  const TOOLS = { focus: ['⏳', 'Focus timer', '#explore/focus'], breathe: ['🫧', 'Breathe', '#explore/breathe'], stretch: ['🧘', 'Stretch', '#explore/stretch'], sounds: ['🎧', 'Sounds', '#explore/sounds'], reflect: ['✍️', 'Reflect', '#explore/reflect'] };

  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[*-]\s+/gm, '• ');

  function crisisCard(c, plan) {
    return `<div class="card" style="background:#fbe9e4;border:2px solid #e8a090" id="crisis">
      <b>${c.level === 'high' ? 'Please reach out now — you don’t have to get through this alone.' : 'It sounds really heavy right now.'}</b>
      ${plan?.person ? `<div style="margin:.5em 0">📞 Your safety plan: <b>${esc(plan.person)}</b>${plan.person_phone ? ` — <a href="tel:${esc(plan.person_phone)}">${esc(plan.person_phone)}</a>` : ''}</div>` : ''}
      ${c.resources.map((r) => `<div style="margin:.4em 0"><a href="${esc(r.href)}"><b>${esc(r.name)}</b></a> — ${esc(r.detail)}</div>`).join('')}
      <button class="btn ghost small" id="crisisOk">I’m safe for now</button></div>`;
  }

  function actionChips(actions) {
    return (actions || []).map((a) => {
      if (a.type === 'commitment') return `<div class="chip on small" style="margin:4px 0">✓ Plan saved: ${esc(a.what)}${a.when ? ` — ${esc(a.when)}` : ''}</div>`;
      if (a.type === 'inbox') return `<div class="chip small" style="margin:4px 0">📥 Added to inbox: ${esc(a.text)}</div>`;
      if (a.type === 'goal') return `<div class="chip small" style="margin:4px 0">✅ Added to today: ${esc(a.text)}</div>`;
      if (a.type === 'memory') return `<div class="card small" style="background:var(--bg);margin:6px 0" data-mem="${a.id}">💾 Save to your journal? <b>${esc(a.title)}</b>
        <div class="row" style="margin-top:6px"><button class="btn secondary" data-memok="${a.id}">Save</button><button class="btn ghost" data-memno="${a.id}">Skip</button></div></div>`;
      if (a.type === 'habit') return `<a class="chip small" style="margin:4px 0;text-decoration:none" href="#habits">🔁 Habit ${a.status === 'parked' ? 'parked' : 'added'}: ${esc(a.text)}</a>`;
      if (a.type === 'event') return `<a class="chip small" style="margin:4px 0;text-decoration:none" href="#sober">🎉 Event plan saved: ${esc(a.text)}</a>`;
      if (a.type === 'tool' && TOOLS[a.tool]) return `<a class="chip small" style="margin:4px 0;text-decoration:none" href="${TOOLS[a.tool][2]}">${TOOLS[a.tool][0]} Open ${TOOLS[a.tool][1]}</a>`;
      return '';
    }).join('');
  }

  function bindMemoryButtons(root) {
    root.querySelectorAll('[data-memok]').forEach((b) => b.onclick = async () => {
      try { const r = await api(`/api/plans/memories/${b.dataset.memok}/approve`, { body: {} }); toast(r.saved ? `Saved to Obsidian: ${r.saved}` : 'Saved'); b.closest('[data-mem]').innerHTML = '💾 Saved to your journal'; }
      catch (e) { toast(e.message); }
    });
    root.querySelectorAll('[data-memno]').forEach((b) => b.onclick = async () => { await api(`/api/plans/memories/${b.dataset.memno}/reject`, { body: {} }); b.closest('[data-mem]').remove(); });
  }

  function play(b64) {
    if (!b64) return;
    try { if (audioEl) audioEl.pause(); audioEl = new Audio(`data:audio/mpeg;base64,${b64}`); audioEl.play().catch(() => {}); } catch (_) {}
  }

  async function coach(sub = '') {
    F.setTab('coach');
    info = info || await api('/api/coach/info');
    const [{ messages }, { memories }, safety] = await Promise.all([api('/api/coach/messages'), api('/api/plans/memories'), api('/api/privacy/safety')]);
    const pending = memories.filter((m) => m.status === 'proposed').slice(0, 3);
    const st = F.state;
    const lastActive = st.lastActiveDaysAgo;
    $app.innerHTML = `${F.modeSwitch ? F.modeSwitch('coach') : ''}
      <div class="row"><h1 class="grow">Your coach</h1><button class="btn ghost" id="spk" title="Read replies aloud">${speakReplies ? '🔊' : '🔈'}</button></div>
      <p class="small muted" style="margin-top:-6px">🔒 ${info.local ? `Private — runs on your own server (${esc(info.model)}).` : `<b style="color:var(--danger)">Not local:</b> ${esc(info.model)} — conversations leave your network.`} An AI coach, not a therapist. Chats are encrypted and deleted after ${info.retentionDays} days.</p>
      <div class="tabs2" id="flows">${info.flows.filter((f) => f.id !== 'welcome').map((f) => `<button class="chip" data-flow="${f.id}">${esc(f.label)}</button>`).join('')}</div>
      ${pending.length ? `<div class="card"><b>Waiting for your OK</b>${pending.map((m) => `<div data-mem="${m.id}" style="margin-top:8px"><div class="small"><b>${esc(m.title)}</b></div><div class="small muted" style="white-space:pre-wrap">${esc(m.body.slice(0, 280))}</div>
        <div class="row" style="margin-top:4px"><button class="btn secondary" data-memok="${m.id}">Save to journal</button><button class="btn ghost" data-memno="${m.id}">Skip</button></div></div>`).join('')}</div>` : ''}
      <div id="crisisSlot"></div>
      <div class="card"><div class="chat" id="chat" style="max-height:52vh">${messages.length ? messages.map((m) => m.role === 'event'
        ? `<div class="small muted center">— ${esc(m.content)} —</div>` : `<div class="msg ${m.role}">${m.role === 'assistant' ? md(m.content) : esc(m.content)}</div>`).join('')
        : `<p class="muted">Tap one of the buttons above, or just say what’s going on. Good places to start: <b>📝 Tell my coach about me</b>, or <b>☀️ Plan my morning</b>.</p>`}</div>
        <div class="row" style="margin-top:10px">${info.voice ? '<button class="btn secondary" id="mic" aria-label="Talk" style="min-width:52px">🎙️</button>' : ''}
          <textarea id="say" rows="1" style="min-height:48px" placeholder="Say anything…"></textarea><button class="btn" id="send">Send</button></div>
        <p class="small muted" id="micHint" style="margin:.4em 0 0"></p></div>
      <details class="card"><summary><b>📅 Scan my calendar & email</b> <span class="small muted">(via Hermes — optional)</span></summary><div id="plan" style="margin-top:10px"></div></details>`;
    const chat = document.getElementById('chat');
    chat.scrollTop = chat.scrollHeight;
    bindMemoryButtons($app);

    document.getElementById('spk').onclick = (e) => { speakReplies = !speakReplies; try { localStorage.setItem('finch-speak', speakReplies ? '1' : '0'); } catch (_) {} e.target.textContent = speakReplies ? '🔊' : '🔈'; toast(speakReplies ? 'I’ll read replies aloud' : 'Text only'); };

    const showResult = (r) => {
      document.getElementById('typing')?.remove();
      chat.insertAdjacentHTML('beforeend', `<div class="msg assistant">${md(r.reply)}</div>${actionChips(r.actions)}`);
      bindMemoryButtons(chat);
      if (r.crisis) {
        document.getElementById('crisisSlot').innerHTML = crisisCard(r.crisis, safety.plan);
        document.getElementById('crisisOk').onclick = () => { document.getElementById('crisisSlot').innerHTML = ''; };
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (r.audio) play(r.audio);
      else if (speakReplies) api('/api/coach/speak', { body: { text: r.reply } }).then((s) => play(s.audio)).catch(() => {});
      if (r.actions?.some((a) => a.type === 'goal')) F.refresh();
      chat.scrollTop = chat.scrollHeight;
    };
    const thinking = () => { chat.insertAdjacentHTML('beforeend', `<div class="msg assistant typing" id="typing">thinking…</div>`); chat.scrollTop = chat.scrollHeight; };
    const fail = (e) => { document.getElementById('typing')?.remove(); chat.insertAdjacentHTML('beforeend', `<div class="msg assistant">${esc(e.message)}</div>`); };

    const send = async () => {
      const ta = document.getElementById('say');
      const text = ta.value.trim();
      if (!text) return;
      ta.value = '';
      chat.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(text)}</div>`);
      thinking();
      try { showResult(await api('/api/coach/chat', { body: { text } })); } catch (e) { fail(e); }
    };
    const startFlow = async (id) => {
      const f = info.flows.find((x) => x.id === id);
      chat.insertAdjacentHTML('beforeend', `<div class="small muted center">— ${esc(f ? f.label : id)} —</div>`);
      thinking();
      try { showResult(await api(`/api/coach/flow/${id}`, { body: {} })); } catch (e) { fail(e); }
    };
    document.getElementById('send').onclick = send;
    document.getElementById('say').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    $app.querySelectorAll('[data-flow]').forEach((b) => b.onclick = () => startFlow(b.dataset.flow));

    // Voice: tap to start, tap to stop (hold-to-talk raced getUserMedia: a short press was released before the mic opened).
    const mic = document.getElementById('mic');
    if (mic) mic.onclick = async () => {
      const hint = document.getElementById('micHint');
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      if (recStarting) return;
      if (!navigator.mediaDevices?.getUserMedia) return toast(`Voice needs the https address of ${APP}`);
      recStarting = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          mic.textContent = '🎙️'; hint.textContent = '';
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          if (blob.size < 2000) return;
          thinking();
          try {
            const res = await fetch('/api/coach/voice', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob, credentials: 'same-origin' });
            const r = await res.json();
            if (!r.ok) throw new Error(r.error || 'Voice failed');
            if (r.heard) document.getElementById('typing').insertAdjacentHTML('beforebegin', `<div class="msg user">🎙️ ${esc(r.heard)}</div>`);
            showResult(r);
          } catch (e) { fail(e); }
        };
        rec.start();
        mic.textContent = '⏹️'; hint.textContent = 'Listening… tap ⏹️ when you’re done.';
        setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 90000);
      } catch (e) { toast('Microphone blocked — allow it for this app in your browser settings'); }
      finally { recStarting = false; }
    };

    // Optional Hermes calendar/email scan (separate from the private coach).
    const planEl = document.getElementById('plan');
    const drawPlan = (pl) => {
      if (!pl) { planEl.innerHTML = `<p class="small muted">Asks your Hermes agent to read today’s calendar, unread email and task board (read-only) and suggest small steps. This goes to Hermes, not the private coach.</p><button class="btn secondary block" id="mk">Scan now</button>`; }
      else if (pl.status === 'pending') { planEl.innerHTML = '<p class="typing">Hermes is looking… this can take a minute or two.</p>'; setTimeout(async () => drawPlan((await api('/api/coach/plan')).plan), 5000); return; }
      else if (pl.status === 'failed') planEl.innerHTML = `<p class="small">That didn’t work (${esc(pl.error || '')}).</p><button class="btn secondary block" id="mk">Try again</button>`;
      else planEl.innerHTML = `<p>${esc(pl.summary)}</p>${pl.suggestions.map((sg, i) => `<div class="suggestion"><b>${esc(sg.title)}</b><div class="gmeta">${esc(sg.why)}</div>
          ${sg.accepted ? '<span class="small muted">✓ Added</span>' : `<button class="btn secondary" data-acc="${i}">Add to today</button>`}</div>`).join('')}<button class="btn ghost block" id="mk">Scan again</button>`;
      planEl.querySelector('#mk')?.addEventListener('click', async () => { await api('/api/coach/plan', { body: {} }); drawPlan({ status: 'pending' }); });
      planEl.querySelectorAll('[data-acc]').forEach((b) => b.onclick = async () => { await api(`/api/coach/plan/${pl.id}/accept/${b.dataset.acc}`, { body: {} }); toast('Added to today'); drawPlan((await api('/api/coach/plan')).plan); });
    };
    api('/api/coach/plan').then((r) => drawPlan(r.plan)).catch(() => {});

    // Deep links: #coach/flow/stuck starts a flow; a long absence offers a gentle welcome back.
    const [kind, arg] = sub.split('/');
    if (kind === 'flow' && arg) startFlow(arg);
    else if (!messages.length && lastActive != null && lastActive >= 4) startFlow('welcome');
  }

  F.routes.coach = coach;
  F.coachFlow = (id) => { location.hash = `#coach/flow/${id}`; };
})();
