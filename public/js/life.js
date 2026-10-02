/* Your people, inbox, safety plan and privacy pages. */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const RING_LABEL = { closest: 'Closest (~5)', close: 'Close (~15)', friends: 'Friends (~50)', wider: 'Wider' };
  const ago = (t) => { if (!t) return 'never'; const d = Math.floor((Date.now() - new Date(t)) / 86400000); return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  const waLink = (p) => { const h = (p.handles || []).find((x) => x.kind === 'whatsapp' && /^\d{8,15}$/.test(x.handle)); return h ? `https://wa.me/${h.handle}` : null; };

  // ---------- people ----------
  async function people() {
    F.setTab('friends');
    const d = await api('/api/people');
    const live = d.live || {};
    $app.innerHTML = `
      <div class="row"><h1 class="grow">Your people</h1><a class="btn ghost" href="#friends">Friends ›</a></div>
      <p class="small muted" style="margin-top:-6px">ADHD makes people “out of sight, out of mind”. ${APP} keeps track of when you were last in touch — never what you said.</p>
      <div class="card"><h2>Might be nice to reach out</h2>${d.due.length ? d.due.map((p) => { const full = d.people.find((x) => x.id === p.id) || p; const wa = waLink(full);
        return `<div class="friend"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.reason)}</div></div>
          ${wa ? `<a class="btn secondary" href="${wa}" target="_blank" rel="noopener">Message</a>` : ''}
          <button class="btn ghost" data-touch="${p.id}" title="I’ve been in touch">✓</button><button class="btn ghost" data-snooze="${p.id}" title="Not now">💤</button></div>`; }).join('')
        + '<p class="small muted" style="margin:.6em 0 0">People are usually more pleased to hear from you than you expect — even after a long gap.</p>'
        : '<p class="muted small">Nobody’s due. Add people below and choose how often you’d like to be in touch.</p>'}
        <a class="btn ghost block" href="#coach/flow/people">💬 Help me write a message</a></div>
      <div class="card"><div class="row"><h2 class="grow">Everyone</h2><button class="btn secondary" id="add">+ Add</button></div>
        ${['closest', 'close', 'friends', 'wider'].map((r) => { const list = d.people.filter((p) => p.ring === r); return list.length ? `<h3 style="margin-top:10px">${RING_LABEL[r]}</h3>${list.map((p) =>
          `<div class="friend" data-edit="${p.id}" style="cursor:pointer"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">last in touch ${ago(p.last_sent_at > p.last_received_at ? p.last_sent_at : (p.last_received_at || p.last_sent_at))}${p.cadence_days ? ` · every ~${p.cadence_days} days` : ''}${p.birthday ? ` · 🎂 ${esc(p.birthday)}` : ''}</div></div><span>›</span></div>`).join('')}` : ''; }).join('') || '<p class="muted small">No one yet.</p>'}</div>
      <div class="card"><h2>Who’s this?</h2><p class="small muted">Contacts from your message history that aren’t named yet, busiest first. Name the ones that matter; ignore the rest (work contacts stay unnamed and are never used).</p>
        <div id="unl"><button class="btn secondary block" id="loadU">Show contacts to name</button></div></div>
      ${live.available ? `<div class="card"><h2>Live WhatsApp link</h2>
        <p class="small muted">A linked device that notes who and when — never message text, never groups. Unlink any time here or in WhatsApp → Linked devices.</p>
        <div id="wa">${live.state === 'linked' ? '✅ Linked and keeping “last in touch” up to date.' : live.state === 'waiting-for-scan' && live.qr ? '' : `<p class="small">Status: ${esc(live.state || 'not linked')}</p>`}</div>
        ${live.state === 'linked' ? '<button class="btn ghost" id="waOff">Unlink</button>' : '<button class="btn secondary block" id="waOn">Link WhatsApp</button>'}</div>` : ''}`;

    $app.querySelectorAll('[data-touch]').forEach((b) => b.onclick = async () => { await api(`/api/people/${b.dataset.touch}/touched`, { body: {} }); toast('Lovely 💛'); people(); });
    $app.querySelectorAll('[data-snooze]').forEach((b) => b.onclick = async () => { await api(`/api/people/${b.dataset.snooze}/snooze`, { body: { days: 7 } }); toast('Snoozed for a week'); people(); });
    $app.querySelectorAll('[data-edit]').forEach((r) => r.onclick = () => personSheet(d.people.find((p) => p.id === r.dataset.edit), d.rings));
    document.getElementById('add').onclick = () => personSheet(null, d.rings);
    document.getElementById('loadU').onclick = async () => {
      const { handles } = await api('/api/people/unlinked');
      document.getElementById('unl').innerHTML = handles.length ? handles.map((h, i) => `<div class="friend"><div class="grow"><b>${esc(h.display || (h.kind === 'whatsapp' ? `+${h.handle}` : h.handle))}</b>
        <div class="small muted">${h.kind} · ${h.msgs} messages · last ${esc(h.last_day)}${h.last_year ? ` · ${h.last_year} this year` : ''}</div></div>
        <button class="btn secondary" data-name="${i}">Name</button></div>`).join('') : '<p class="small muted">Nothing to name. Import history or link WhatsApp first.</p>';
      document.querySelectorAll('[data-name]').forEach((b) => b.onclick = () => { const h = handles[+b.dataset.name]; personSheet(null, d.rings, h); });
    };
    const pollWa = async () => {
      const s = await api('/api/people/whatsapp/status').catch(() => null);
      const el = document.getElementById('wa'); if (!el || !s) return;
      if (s.state === 'linked') { toast('WhatsApp linked'); return people(); }
      el.innerHTML = s.qr ? `<p class="small">On your phone: WhatsApp → Settings → Linked devices → Link a device, then scan:</p><img src="${s.qr}" alt="QR code" style="width:240px;max-width:100%;display:block;margin:auto">` : `<p class="small">Status: ${esc(s.state)}…</p>`;
      setTimeout(pollWa, 4000);
    };
    document.getElementById('waOn')?.addEventListener('click', async () => { await api('/api/people/whatsapp/start', { body: {} }); pollWa(); });
    document.getElementById('waOff')?.addEventListener('click', async () => { if (confirm('Unlink WhatsApp?')) { await api('/api/people/whatsapp/logout', { body: {} }); people(); } });
  }

  function personSheet(p, rings, handle) {
    const ring = p?.ring || 'friends';
    sheet(`<h1>${p ? esc(p.name) : 'Add someone'}</h1>
      <div class="field"><label for="pn">Name</label><input id="pn" maxlength="60" value="${esc(p?.name || handle?.display || '')}"></div>
      <div class="field"><label>How close?</label><div class="row wrap">${Object.keys(RING_LABEL).map((r) => `<button class="chip ${r === ring ? 'on' : ''}" data-ring="${r}">${RING_LABEL[r]}</button>`).join('')}</div></div>
      <div class="field"><label for="pc">Remind me if we haven’t been in touch for (days)</label><input id="pc" type="number" min="1" max="730" value="${p ? (p.cadence_days ?? '') : rings[ring]}" placeholder="blank = no reminders"></div>
      <div class="field"><label for="pb">Birthday (MM-DD)</label><input id="pb" maxlength="5" placeholder="e.g. 03-27" value="${esc(p?.birthday || '')}"></div>
      <div class="field"><label for="pnotes">Your notes</label><textarea id="pnotes" placeholder="Kids’ names, what they’re up to, things to ask about…">${esc(p?.notes || '')}</textarea></div>
      ${handle ? `<p class="small muted">Linking ${esc(handle.kind)} contact ${esc(handle.display || handle.handle)}.</p>` : ''}
      <button class="btn block" id="save">Save</button>${p ? '<button class="btn ghost block" id="rm">Remove from my people</button>' : ''}`, (sh, close) => {
      let chosen = ring;
      sh.querySelectorAll('[data-ring]').forEach((b) => b.onclick = () => { chosen = b.dataset.ring; sh.querySelectorAll('[data-ring]').forEach((x) => x.classList.toggle('on', x === b)); if (!p) sh.querySelector('#pc').value = rings[chosen]; });
      sh.querySelector('#save').onclick = async () => {
        const body = { name: sh.querySelector('#pn').value, ring: chosen, cadence_days: sh.querySelector('#pc').value || null, birthday: sh.querySelector('#pb').value, notes: sh.querySelector('#pnotes').value,
          ...(handle ? { kind: handle.kind, handle: handle.handle } : {}) };
        try { await api(p ? `/api/people/${p.id}` : '/api/people', { method: p ? 'PUT' : 'POST', body }); close(); people(); } catch (e) { toast(e.message); }
      };
      sh.querySelector('#rm')?.addEventListener('click', async () => { if (confirm(`Remove ${p.name}?`)) { await api(`/api/people/${p.id}`, { method: 'DELETE' }); close(); people(); } });
    });
  }

  // ---------- inbox ----------
  async function inbox() {
    F.setTab('home');
    const { items } = await api('/api/plans/inbox');
    $app.innerHTML = `<a href="#home" class="btn ghost" style="padding-left:0">‹ Home</a><h1>Inbox</h1>
      <p class="small muted">One list for everything, so it’s not living in your head. Pull one thing into today when you’re ready.</p>
      <div class="row"><input id="cap" placeholder="Capture…" maxlength="300"><button class="btn" id="go">+</button></div><div style="height:12px"></div>
      <div class="card">${items.length ? items.map((i) => `<div class="goal"><div class="grow"><div class="gtitle">${esc(i.text)}</div>${i.due_on ? `<div class="gmeta">due ${esc(i.due_on)}</div>` : ''}</div>
        <button class="btn secondary" data-a="today" data-id="${i.id}">Today</button><button class="btn ghost" data-a="done" data-id="${i.id}">✓</button><button class="btn ghost" data-a="dropped" data-id="${i.id}" title="Let it go">🗑</button></div>`).join('') : '<p class="muted">Empty. Nice.</p>'}</div>`;
    const add = async () => { const el = document.getElementById('cap'); if (el.value.trim()) { await api('/api/plans/inbox', { body: { text: el.value } }); inbox(); } };
    document.getElementById('go').onclick = add;
    document.getElementById('cap').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $app.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => { await api(`/api/plans/inbox/${b.dataset.id}/${b.dataset.a}`, { body: {} }); toast(b.dataset.a === 'today' ? 'Added to today' : 'Done'); await F.refresh(); inbox(); });
  }

  // ---------- safety plan ----------
  async function safety() {
    F.setTab('me');
    const { plan, resources } = await api('/api/privacy/safety');
    const f = (k, label, ph, area) => `<div class="field"><label for="${k}">${label}</label>${area ? `<textarea id="${k}" placeholder="${ph}">${esc(plan[k] || '')}</textarea>` : `<input id="${k}" placeholder="${ph}" value="${esc(plan[k] || '')}">`}</div>`;
    $app.innerHTML = `<a href="#me" class="btn ghost" style="padding-left:0">‹ Me</a><h1>Safety plan</h1>
      <p class="small muted">For hard moments. If the coach ever hears that you’re struggling badly, it shows this alongside the helplines. Nobody is contacted automatically — ever.</p>
      <div class="card">${f('person', 'Someone I can contact', 'e.g. Sam')}${f('person_phone', 'Their number', '07…')}${f('gp', 'My GP surgery', 'Surgery name')}${f('gp_phone', 'GP phone', '')}
        ${f('warning_signs', 'My warning signs', 'Not sleeping, cancelling everything, drinking more…', 1)}${f('helps', 'Things that help me', 'A walk, a shower, calling my brother…', 1)}${f('reasons', 'Reasons to keep going', '', 1)}
        <button class="btn block" id="save">Save</button></div>
      <div class="card"><h2>Always available</h2>${resources.map((r) => `<div style="margin:.4em 0"><a href="${esc(r.href)}"><b>${esc(r.name)}</b></a> — ${esc(r.detail)}</div>`).join('')}</div>`;
    document.getElementById('save').onclick = async () => {
      const body = {}; ['person', 'person_phone', 'gp', 'gp_phone', 'warning_signs', 'helps', 'reasons'].forEach((k) => { body[k] = document.getElementById(k).value; });
      await api('/api/privacy/safety', { body }); toast('Saved');
    };
  }

  // ---------- privacy ----------
  async function privacy() {
    F.setTab('me');
    const [{ profile }, info, { memories }] = await Promise.all([api('/api/privacy/profile'), api('/api/coach/info'), api('/api/plans/memories')]);
    const saved = memories.filter((m) => m.status === 'approved');
    $app.innerHTML = `<a href="#me" class="btn ghost" style="padding-left:0">‹ Me</a><h1>Your coach & privacy</h1>
      <div class="card small"><b>Where your conversations go</b><br>${info.local ? `Only to the model on your own server (<code>${esc(info.model)}</code>). No web, email, calendar or other tools — the coach can only touch ${APP}.` : `<b style="color:var(--danger)">To a non-local model:</b> ${esc(info.model)}. Your conversations leave your network.`}
        <br>Chats are encrypted at rest and deleted after ${info.retentionDays} days. Only things you approve are saved to your journal.</div>
      <div class="card"><h2>What your coach knows about you</h2>${profile ? `<pre class="small" style="white-space:pre-wrap">${esc(JSON.stringify(profile, null, 2))}</pre><button class="btn ghost" id="forget">Forget this</button>` : '<p class="small muted">Nothing yet.</p>'}
        <a class="btn secondary block" href="#coach/flow/intake" style="margin-top:8px;text-align:center;text-decoration:none">${profile ? 'Update it' : 'Tell my coach about me'}</a></div>
      <div class="card"><h2>Saved to your journal (${saved.length})</h2>${saved.slice(0, 15).map((m) => `<div class="small" style="margin:6px 0"><b>${esc(m.title)}</b> <span class="muted">${new Date(m.created_at).toLocaleDateString('en-GB')}${m.vault_path ? ` · ${esc(m.vault_path)}` : ''}</span></div>`).join('') || '<p class="small muted">Nothing yet.</p>'}</div>
      <div class="card"><h2>Your data</h2><a class="btn secondary block" href="/api/privacy/export" style="text-align:center;text-decoration:none">Download everything (JSON)</a>
        <div style="height:10px"></div><button class="btn ghost block" id="wipe" style="color:var(--danger)">Delete all coach conversations…</button></div>`;
    document.getElementById('forget')?.addEventListener('click', async () => { if (confirm('Delete what your coach knows about you?')) { await api('/api/privacy/profile', { method: 'DELETE' }); privacy(); } });
    document.getElementById('wipe').onclick = async () => {
      const t = prompt('This permanently deletes every coach conversation. Type WIPE to confirm.');
      if (t !== 'WIPE') return;
      await api('/api/privacy/wipe', { body: { confirm: 'WIPE', profile: confirm('Also forget what the coach knows about you?') } }); toast('Deleted'); privacy();
    };
  }

  // ---------- share with GP / therapist (PDF) ----------
  function report() {
    F.setTab('me');
    const SECTIONS = [
      ['summary', 'Summary', 'Key numbers for the period', true],
      ['mood', 'Mood diary', 'Daily mood & energy chart, feelings you named', true],
      ['notes', '…including my written notes', 'What you typed at check-ins', false],
      ['questionnaires', 'Questionnaires', 'GAD-7, PHQ-9, WHO-5 scores over time', true],
      ['sobriety', 'Substance / behaviour tracking', 'Free days, days used, urges and triggers, AUDIT', true],
      ['habits', 'Habits', 'What you’re building and how often', true],
      ['reflections', 'Reflections', 'Your written reflections', false],
      ['journal', 'Journal', 'Entries you saved from your coach', false],
    ];
    const today = new Date().toISOString().slice(0, 10);
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    let from = ago(90), to = today;
    $app.innerHTML = `<a href="#me" class="btn ghost" style="padding-left:0">‹ Me</a><h1>Share with my GP or therapist</h1>
      <p class="small muted">Makes a PDF of what you choose — nothing else. It’s built on your own server; your coach conversations are never included.</p>
      <div class="card"><div class="field"><label>Period</label><div class="row wrap">${[[30, 'Last month'], [90, '3 months'], [180, '6 months'], [365, 'A year']].map(([n, l]) => `<button class="chip ${n === 90 ? 'on' : ''}" data-days="${n}">${l}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px"><input type="date" id="rf" value="${from}"><span>to</span><input type="date" id="rt" value="${to}"></div></div>
        <div class="field"><label>Include</label>${SECTIONS.map(([k, n, d, on]) => `<label class="row" style="padding:6px 0;${k === 'notes' ? 'margin-left:28px' : ''}"><input type="checkbox" data-sec="${k}" ${on ? 'checked' : ''} style="width:22px;height:22px"><span><b>${n}</b><br><span class="small muted">${d}</span></span></label>`).join('')}</div></div>
      <div class="row"><button class="btn secondary grow" id="prev">Preview</button><button class="btn grow" id="dl">Download PDF</button></div>
      ${navigator.share ? '<div style="height:10px"></div><button class="btn warm block" id="share">Share…</button>' : ''}
      <p class="small muted" style="margin-top:12px">Tip: if anything in your notes is private, leave “written notes” and reflections unticked — the charts and scores are usually what clinicians want.</p>`;
    const url = (inline) => { const s = [...$app.querySelectorAll('[data-sec]:checked')].map((x) => x.dataset.sec).join(','); return `/api/report/pdf?from=${document.getElementById('rf').value}&to=${document.getElementById('rt').value}&s=${s}${inline ? '&inline=1' : ''}`; };
    $app.querySelectorAll('[data-days]').forEach((b) => b.onclick = () => { document.getElementById('rf').value = ago(+b.dataset.days); document.getElementById('rt').value = today; $app.querySelectorAll('[data-days]').forEach((x) => x.classList.toggle('on', x === b)); });
    document.getElementById('prev').onclick = () => window.open(url(true), '_blank');
    document.getElementById('dl').onclick = () => { location.href = url(false); };
    document.getElementById('share')?.addEventListener('click', async () => {
      try {
        const r = await fetch(url(false), { credentials: 'same-origin' });
        if (!r.ok) throw new Error('Couldn’t make the PDF');
        const file = new File([await r.blob()], `wellbeing-record-${document.getElementById('rf').value}-to-${document.getElementById('rt').value}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) { location.href = url(false); return; }
        await navigator.share({ files: [file], title: 'My wellbeing record' });
      } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
    });
  }

  F.routes.report = report;
  F.routes.people = people;
  F.routes.inbox = inbox;
  F.routes.safety = safety;
  F.routes.privacy = privacy;
})();
