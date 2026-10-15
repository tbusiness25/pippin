/*
 * Parent view of a child's Buddy chats: every conversation, every safety flag, and "mark reviewed".
 * Family → <child> → Buddy (#family/child/<id>/buddy[/s/<sessionId>]).
 */
(function () {
  const { esc, toast } = F;
  const FLAG_LABEL = {
    hard_block: 'Blocked words', context_block: 'Safety check stopped it', pii: 'Personal details hidden', injection: 'Tried to change Buddy’s rules',
    output_block: 'Reply replaced', human_claim: 'Reply rewritten (claimed to be human)', secret_promise: 'Reply rewritten (secret promise)',
    medical: 'Reply rewritten (medicine)', refusal: 'Reply softened', too_long: 'Reply shortened', llm_error: 'Buddy had a hiccup',
  };
  const label = (t) => String(t || '').split('+').map((x) => FLAG_LABEL[x] || x.replace(/_/g, ' ')).join(' · ');
  const when = (d) => new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const base = (child) => `#family/child/${child.id}/buddy`;

  function msgHtml(m) {
    const reviewed = m.reviewed_at ? `<span class="bp-flag done">✓ reviewed${m.reviewed_by ? ` by ${esc(m.reviewed_by)}` : ''}</span>` : '';
    return `<div class="bp-msg ${m.role}${m.flagged ? ' flagged' : ''}" data-id="${m.id}">
      <div>${m.role === 'user' && m.voice ? '🎙️ ' : ''}${esc(m.content).replace(/\n/g, '<br>')}</div>
      ${m.raw_content ? `<div class="raw small"><b>What they actually said:</b> ${esc(m.raw_content)}</div>` : ''}
      <div class="meta">${m.role === 'user' ? 'Child' : 'Buddy'} · ${when(m.created_at)}${m.drifting ? ' · silly/testing' : ''}
        ${m.flagged ? `<br><span class="bp-flag${m.reviewed_at ? ' done' : ''}">🚩 ${esc(label(m.flag_type))}</span> <span class="small">${esc(m.flag_reason || '')}</span> ${reviewed}
          ${m.reviewed_at ? '' : `<button class="btn ghost bp-ok" data-id="${m.id}" style="min-height:36px">Mark reviewed</button>`}` : ''}</div></div>`;
  }

  function wireReview(el, child, after) {
    el.querySelectorAll('.bp-ok').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { await F.family.kapi(child, '/buddy/parent/review', { body: { ids: [Number(b.dataset.id)] } }); toast('Marked reviewed'); after(); }
      catch (e) { toast(e.message); b.disabled = false; }
    });
  }

  async function overview(el, child) {
    const [sum, flags, ses] = await Promise.all([
      F.family.kapi(child, '/buddy/parent/summary'),
      F.family.kapi(child, '/buddy/parent/messages?unreviewed=true&limit=50'),
      F.family.kapi(child, '/buddy/parent/sessions?limit=60'),
    ]);
    el.innerHTML = `<h1>💬 ${esc(child.name)}’s Buddy chats</h1>
      <p class="small muted">Buddy is a safe chat friend: no web, no tools. Risky words are blocked before the AI sees them, personal details are hidden from it, and every reply is checked. You can read everything here.</p>
      <div class="bp-stats"><span class="stat">🚩 ${sum.pendingReview} to review</span><span class="stat">💬 ${sum.last7d.sessions} chats this week</span>
        <span class="stat">✉️ ${sum.last7d.msgs} messages</span>${sum.limitEnabled ? `<span class="stat">⏱️ ${sum.dailyLimit} min/day</span>` : ''}</div>
      ${flags.messages.length ? `<div class="card"><div class="row"><h2 class="grow">To review</h2><button class="btn ghost" id="bpAll">Mark all reviewed</button></div>
        ${flags.messages.map((m) => `${msgHtml(m)}<a class="small" href="${base(child)}/s/${m.session_id}">See the whole chat ›</a>`).join('')}</div>` : ''}
      <div class="card"><h2>Conversations</h2>
        ${ses.sessions.length ? ses.sessions.map((s) => `<a class="bp-sess" href="${base(child)}/s/${s.session_id}">
          <div class="row"><b class="grow">${when(s.last)}</b>${s.unreviewed ? `<span class="bp-flag">🚩 ${s.unreviewed}</span>` : s.flagged ? '<span class="bp-flag done">✓</span>' : ''}</div>
          <div class="small muted">${esc(s.preview || '…')}</div>
          <div class="small muted">${s.said} message${s.said === 1 ? '' : 's'}${s.spoken ? ` · ${s.spoken} spoken` : ''}</div></a>`).join('')
        : `<p class="muted small">No chats yet. ${esc(child.name)} can find Buddy in their app.</p>`}</div>
      <p class="small"><a href="/api/kids/buddy/parent/export?child=${encodeURIComponent(child.id)}" download>Download all chats (JSON)</a></p>`;
    wireReview(el, child, () => overview(el, child));
    el.querySelector('#bpAll')?.addEventListener('click', async () => {
      if (!confirm('Mark every flag as reviewed?')) return;
      try { const r = await F.family.kapi(child, '/buddy/parent/review', { body: { all: true } }); toast(`${r.marked} marked`); overview(el, child); }
      catch (e) { toast(e.message); }
    });
  }

  async function transcript(el, child, sessionId) {
    const { messages } = await F.family.kapi(child, `/buddy/parent/messages?session=${encodeURIComponent(sessionId)}&limit=500`);
    const open = messages.filter((m) => m.flagged && !m.reviewed_at).length;
    el.innerHTML = `${F.family.back(base(child), 'All chats')}<h1>Chat · ${messages[0] ? esc(when(messages[0].created_at)) : ''}</h1>
      ${open ? `<button class="btn block" id="bpSess">Mark this chat reviewed (${open})</button>` : ''}
      <div class="card">${messages.map(msgHtml).join('') || '<p class="muted">Nothing here.</p>'}</div>`;
    wireReview(el, child, () => transcript(el, child, sessionId));
    el.querySelector('#bpSess')?.addEventListener('click', async () => {
      try { await F.family.kapi(child, '/buddy/parent/review', { body: { session: sessionId } }); toast('Marked reviewed'); transcript(el, child, sessionId); }
      catch (e) { toast(e.message); }
    });
  }

  F.family.childPanel({
    id: 'buddy', module: 'buddy', emoji: '💬', name: 'Buddy chats', sub: 'Read chats · safety flags', order: 60,
    async render(el, child, rest) {
      const [k, id] = (rest || '').split('/');
      if (k === 's' && id) return transcript(el, child, id);
      return overview(el, child);
    },
  });
})();
