/*
 * Family → a child's Messages: the chat thread with them (their notes to you and your replies), and their voice notes.
 * Opening it marks his notes as seen. You can remove a note (soft delete). (src/kids/hopenotes.js)
 */
(function () {
  const { esc } = F;
  F.family.childPanel({ id: 'messages', emoji: '💬', name: 'Messages', sub: 'Chat with them, and their voice notes', order: 34, render: panel });

  const when = (s) => new Date(s).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  async function panel(el, child) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const kapi = (p, o) => F.family.kapi(child, p, o);
    const d = await kapi('/notes');
    await kapi('/notes/read', { method: 'POST' }).catch(() => {});
    const qs = `?child=${encodeURIComponent(child.id)}`;
    const row = (m) => {
      const fromKid = m.sender === 'child';
      const body = m.kind === 'voice' ? (m.has_audio ? `<audio controls preload="none" src="/api/kids/notes/${m.id}/audio${qs}"></audio>` : '🎙 voice note') : esc(m.body);
      return `<div class="kn-msg ${fromKid ? 'theirs' : 'mine'}"><div class="kn-who">${esc(fromKid ? child.name : (m.parent_name || 'Mum or Dad'))}</div>
        <div class="kn-bubble">${body}</div><div class="kn-time">${when(m.created_at)} <button class="kn-del" data-del="${m.id}" aria-label="Remove this note">✕</button></div></div>`;
    };
    el.innerHTML = `<div class="card kn-card"><h2 style="margin-top:0">💬 Chat with ${esc(child.name)}</h2>
      <div class="kn-thread" id="pmThread">${d.messages.map(row).join('') || '<p class="muted small center">No messages yet.</p>'}</div>
      <textarea id="pmText" rows="2" maxlength="1000" placeholder="Reply to ${esc(child.name)}…" aria-label="Your reply" style="margin-top:10px"></textarea>
      <div class="row"><button class="btn" id="pmSend" style="margin-left:auto">Send reply</button></div>
      <p class="small muted">${esc(child.name)} sees your reply as a notification.</p></div>`;
    const thread = el.querySelector('#pmThread'); thread.scrollTop = thread.scrollHeight;
    el.querySelector('#pmSend').onclick = async (ev) => {
      const text = el.querySelector('#pmText').value.trim(); if (!text) return F.toast('Write something first');
      ev.currentTarget.disabled = true;
      try { await kapi('/notes/reply', { method: 'POST', body: { text } }); F.toast('Sent 💬'); panel(el, child); }
      catch (e) { F.toast(e.message); ev.currentTarget.disabled = false; }
    };
    el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => {
      if (!confirm('Remove this note from the thread?')) return;
      await kapi(`/notes/${b.dataset.del}`, { method: 'DELETE' }); panel(el, child);
    }; });
  }
})();
