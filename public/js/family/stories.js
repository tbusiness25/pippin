/* Family → child → "Stories": see the story queue (what they asked for, what's being written, what failed),
 * queue a surprise bedtime story, cancel a queued one or try a failed one again. */
(function () {
  const { esc, toast } = F;
  const STATUS = { queued: '⏳ waiting', working: '✍️ being written', ready: '✅ ready', failed: '⚠️ failed', cancelled: '✖ cancelled' };
  const SOURCE = { child: 'they asked', nightly: 'bedtime', parent: 'a parent' };

  F.family.childPanel({ id: 'stories', module: 'stories', emoji: '🌙', name: 'Stories', sub: 'Their story requests', order: 41,
    async render(el, child) {
      const [d, o] = await Promise.all([F.family.kapi(child, '/stories'), F.family.kapi(child, '/stories/options')]);
      const label = (g, id) => ((o.options[g] || []).find((x) => String(x.id) === String(id)) || {}).label || id;
      el.innerHTML = `<h1>🌙 ${esc(child.name)}’s stories</h1>
        <div class="card"><p class="small muted">${esc(child.name)} picks the ingredients; a story writer makes it in a few minutes. One at a time.</p>
          <button class="btn block" id="surprise" ${d.busy ? 'disabled' : ''}>✨ Queue a surprise story now</button></div>
        ${d.stories.length ? d.stories.map((s) => `<div class="card" data-id="${s.id}"><div class="row"><b class="grow">${esc(s.title || `${label('theme', s.theme)}`)}</b><span class="small">${STATUS[s.status] || esc(s.status)}</span></div>
            <div class="small muted">${new Date(s.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(SOURCE[s.source] || s.source)} · ${esc(s.length_min)} min</div>
            <div class="small">${esc(label('theme', s.theme))} · ${(s.characters || []).map((c) => esc(label('characters', c))).join(', ')} · ${esc(label('setting', s.setting))} · ${esc(label('plot', s.plot))}${s.extra ? ` · “${esc(s.extra)}”` : ''}</div>
            ${s.error ? `<div class="small" style="color:var(--danger)">${esc(s.error)}</div>` : ''}
            ${s.playable && s.library_item_id ? `<audio controls preload="none" style="width:100%;margin-top:8px" src="/api/kids/library/${s.library_item_id}/audio?child=${encodeURIComponent(child.id)}"></audio>` : ''}
            ${s.status === 'queued' ? '<button class="btn ghost" data-a="cancel">Cancel</button>' : ''}${s.status === 'failed' ? '<button class="btn ghost" data-a="retry">Try again</button>' : ''}</div>`).join('')
          : '<p class="muted">No stories yet.</p>'}`;
      el.querySelector('#surprise').onclick = async () => {
        try { await F.family.kapi(child, '/stories/surprise', { body: {} }); toast('Queued ✓'); this.render(el, child); } catch (e) { toast(e.message); }
      };
      el.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
        try { await F.family.kapi(child, `/stories/${b.closest('[data-id]').dataset.id}/${b.dataset.a}`, { body: {} }); toast('Done'); this.render(el, child); }
        catch (e) { toast(e.message); }
      });
    } });
})();
