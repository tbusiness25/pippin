/* Family → child → "Learn drafts": AI-drafted Learn modules wait here until a parent reads them.
 * Approve (it appears in Learn), reject, or edit the title/words first. Ask for a new draft on a topic.
 * Nothing is ever published without a parent approving it. The catalogue is shared by all children. */
(function () {
  const { esc, toast } = F;

  F.family.childPanel({ id: 'learn-review', module: 'learn', emoji: '🧠', name: 'Learn drafts', sub: 'Check new modules first', order: 43,
    async render(el, child, rest) {
      const status = ['pending_review', 'approved', 'rejected', 'all'].includes(rest) ? rest : 'pending_review';
      const d = await F.family.kapi(child, `/learn/review?status=${status}`);
      const topicName = (id) => (d.topics.find((t) => t.id === id) || { title: id }).title;
      const block = F.klearnBlock || ((b) => `<p>${esc(b && (b.value || b.text) || '')}</p>`);
      el.innerHTML = `<h1>🧠 Learn drafts</h1>
        ${d.draftsEnabled ? `<div class="card"><h2>Ask for a new module</h2>
          <div class="field"><label for="lt">What should it be about?</label><input id="lt" maxlength="300" placeholder="e.g. why we yawn"></div>
          <div class="field"><label for="lg">Section</label><select id="lg">${d.topics.map((t) => `<option value="${esc(t.id)}">${esc(t.emoji)} ${esc(t.title)}</option>`).join('')}</select></div>
          <button class="btn block" id="draft">Draft it</button><p class="small muted">It arrives here for you to check — it never goes straight to a child.</p></div>` : ''}
        <div class="tabs2">${[['pending_review', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) =>
          `<a class="chip ${k === status ? 'on' : ''}" href="#family/child/${child.id}/learn-review/${k}" style="text-decoration:none">${l}</a>`).join('')}</div>
        ${d.modules.length ? d.modules.map((m) => `<div class="card" data-id="${m.id}">
            <div class="row"><b class="grow">${esc(m.title)}</b><span class="small muted">${esc(topicName(m.topic))} · ${esc(m.review_status.replace('_', ' '))}</span></div>
            ${m.draft_topic_prompt ? `<p class="small muted">Asked for: ${esc(m.draft_topic_prompt)}</p>` : ''}
            <details><summary>Read it</summary><div class="ln-body">${(Array.isArray(m.body) ? m.body : []).map(block).join('') || '<p class="muted">(empty)</p>'}</div></details>
            <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
              ${m.review_status !== 'approved' ? '<button class="btn" data-a="approve">Approve</button>' : ''}
              ${m.review_status !== 'rejected' ? '<button class="btn secondary" data-a="reject">Reject</button>' : ''}
              <button class="btn ghost" data-a="edit">Edit</button></div></div>`).join('')
          : `<p class="muted">${status === 'pending_review' ? 'No drafts waiting.' : 'Nothing here.'}</p>`}`;
      const again = () => this.render(el, child, rest);
      el.querySelector('#draft')?.addEventListener('click', async (ev) => {
        const b = ev.currentTarget; b.disabled = true; b.textContent = 'Drafting… (up to a minute)';
        try { await F.family.kapi(child, '/learn/review/draft', { body: { topic: el.querySelector('#lt').value, topic_group: el.querySelector('#lg').value } }); toast('Draft ready to check'); again(); }
        catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Draft it'; }
      });
      el.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
        const id = b.closest('[data-id]').dataset.id, m = d.modules.find((x) => x.id === id);
        if (b.dataset.a === 'edit') return edit(m);
        try { await F.family.kapi(child, `/learn/review/${id}/${b.dataset.a}`, { body: {} }); toast(b.dataset.a === 'approve' ? 'Approved — it’s in Learn now' : 'Rejected'); again(); }
        catch (e) { toast(e.message); }
      });
      const edit = (m) => F.sheet(`<h1>Edit</h1><div class="field"><label for="et">Title</label><input id="et" maxlength="200" value="${esc(m.title)}"></div>
        <div class="field"><label for="eb">Words (JSON list of blocks)</label><textarea id="eb" style="min-height:260px;font-family:monospace;font-size:.8rem">${esc(JSON.stringify(m.body, null, 2))}</textarea></div>
        <button class="btn block" id="es">Save</button>`, (sh, close) => sh.querySelector('#es').onclick = async () => {
        let body;
        try { body = JSON.parse(sh.querySelector('#eb').value); } catch (_) { return toast('That isn’t valid JSON'); }
        if (!Array.isArray(body)) return toast('It must be a list [ … ]');
        try { await F.family.kapi(child, `/learn/review/${m.id}`, { method: 'PATCH', body: { title: sh.querySelector('#et').value, body } }); close(); toast('Saved'); again(); }
        catch (e) { toast(e.message); }
      });
    } });
})();
