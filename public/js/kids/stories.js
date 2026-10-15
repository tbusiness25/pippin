/* Kids → Stories: "Make me a story". Pick what it's about, who's in it, where and what happens, and how long;
 * a story writer makes it (a few minutes) and it appears here and in Listen. One at a time.
 * Route: #k/stories */
(function () {
  const { esc, toast } = F;
  let OPTIONS = null, poll = null;
  const picked = { theme: null, characters: [], setting: null, plot: null, length_min: 10 };
  const GROUPS = [['theme', 'What’s it about?'], ['characters', 'Who’s in it? (up to 3)'], ['setting', 'Where does it happen?'], ['plot', 'What happens?']];
  const stopPoll = () => { if (poll) { clearInterval(poll); poll = null; } };
  window.addEventListener('hashchange', stopPoll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPoll(); });

  const ready = () => picked.theme && picked.setting && picked.plot && picked.characters.length;
  function updateGo(el) {
    const go = el.querySelector('#st-go');
    if (!go) return;
    go.disabled = !ready();
    go.textContent = ready() ? '✨ Make my story!' : 'Pick one from each box';
  }

  function optBtn(group, o) {
    const on = group === 'characters' ? picked.characters.includes(String(o.id)) : String(picked[group === 'length' ? 'length_min' : group]) === String(o.id);
    return `<button type="button" class="st-opt" data-g="${group}" data-id="${esc(o.id)}" aria-pressed="${on}"><span class="em">${esc(o.emoji || '⏱️')}</span><span>${esc(o.label)}</span></button>`;
  }

  function statusHtml(stories) {
    const active = stories.find((s) => s.status === 'queued' || s.status === 'working');
    if (active) return `<div class="card kid-card st-status working"><b>✍️ Writing your story…</b>
      <p class="small">This takes a few minutes. You can do something else — it will be here when you come back.</p><div class="st-bar"><i></i></div></div>`;
    if (stories[0] && stories[0].status === 'failed') return `<div class="card kid-card st-status"><b>That one didn’t work.</b><p class="small">Try again, or ask a grown-up.</p></div>`;
    return '';
  }
  function listHtml(stories) {
    const done = stories.filter((s) => s.status === 'ready');
    if (!done.length) return '<p class="muted center">No stories yet. Make one!</p>';
    return done.map((s) => `<div class="card kid-card km-item"><div class="km-title">${esc(s.title || 'A story')}</div>
      <div class="km-meta">${s.duration_s ? `<span>${Math.max(1, Math.round(s.duration_s / 60))} min</span>` : ''}${s.source === 'nightly' ? '<span>🌙 bedtime story</span>' : ''}${s.yoto_card_id ? '<span>📻 on your player</span>' : ''}</div>
      ${s.playable && s.library_item_id ? F.kmedia.player(F.kmedia.itemUrl(s.library_item_id), { id: s.library_item_id }) : ''}</div>`).join('');
  }

  async function refresh(el) {
    const d = await F.kids.api('/stories');
    const box = el.querySelector('#st-status'), list = el.querySelector('#st-list');
    if (box) box.innerHTML = statusHtml(d.stories);
    if (list && ![...list.querySelectorAll('audio')].some((a) => !a.paused)) { list.innerHTML = listHtml(d.stories); F.kmedia.wire(list, F.kmedia.played); }
    return d.busy;
  }
  function startPoll(el) {
    stopPoll();
    poll = setInterval(async () => {
      if (!document.body.contains(el.querySelector('#st-list'))) return stopPoll();
      try { if (!(await refresh(el))) { stopPoll(); toast('🌙 Your story is ready!'); } } catch (_) { stopPoll(); }
    }, 10000);
  }

  async function render(el) {
    stopPoll();
    if (!OPTIONS) OPTIONS = (await F.kids.api('/stories/options')).options;
    el.innerHTML = `<div class="kids st">${F.kids.header('Make me a story', '🌙')}
      <div id="st-status"></div>
      ${GROUPS.map(([g, q]) => `<div class="card kid-card"><h2>${esc(q)}</h2><div class="st-opts">${OPTIONS[g].map((o) => optBtn(g, o)).join('')}</div></div>`).join('')}
      <div class="card kid-card"><h2>How long?</h2><div class="st-opts">${OPTIONS.length.map((o) => optBtn('length', o)).join('')}</div>
        <div class="field" style="margin-top:12px"><label for="st-extra">Anything else? (optional)</label>
        <input id="st-extra" maxlength="200" placeholder="e.g. there’s a talking sandwich" autocomplete="off"></div></div>
      <button class="btn block big kid-big-btn" id="st-go" disabled>Pick one from each box</button>
      <h2 style="margin-top:18px">My stories</h2><div id="st-list"></div></div>`;
    el.querySelectorAll('.st-opt').forEach((b) => b.onclick = () => {
      const g = b.dataset.g, id = b.dataset.id;
      if (g === 'characters') {
        if (picked.characters.includes(id)) picked.characters = picked.characters.filter((c) => c !== id);
        else if (picked.characters.length < 3) picked.characters.push(id);
        else return toast('Three is plenty for one story!');
      } else if (g === 'length') picked.length_min = Number(id);
      else picked[g] = id;
      el.querySelectorAll(`.st-opt[data-g="${g}"]`).forEach((x) => x.setAttribute('aria-pressed',
        g === 'characters' ? String(picked.characters.includes(x.dataset.id)) : String(x.dataset.id === String(g === 'length' ? picked.length_min : picked[g]))));
      updateGo(el);
    });
    el.querySelector('#st-go').onclick = async () => {
      const go = el.querySelector('#st-go');
      go.disabled = true; go.textContent = 'Sending…';
      try {
        await F.kids.api('/stories', { body: { ...picked, extra: el.querySelector('#st-extra').value.trim() } });
        el.querySelector('#st-extra').value = '';
        toast('✍️ Your story is being written!');
        if (await refresh(el)) startPoll(el);
        updateGo(el);
      } catch (e) { toast(e.message); updateGo(el); }
    };
    updateGo(el);
    if (await refresh(el)) startPoll(el);
  }

  F.kids.register({ id: 'stories', emoji: '🌙', name: 'Stories', colour: '#5b6fc7', order: 30, tab: true, render });
})();
