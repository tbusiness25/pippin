/* Kids → My room: the few things in their bedroom they may switch themselves (set up by a parent on the server:
 * e.g. a noise machine, a night light) and a sleep timer. F.kroom.draw is reused by the parents' panel.
 * Route: #k/room */
(function () {
  const { esc, toast } = F;

  async function draw(el, api, { title = true } = {}) {
    let d;
    try { d = await api('/room'); }
    catch (e) { console.error('room', e && e.message); el.innerHTML = `${title ? F.kids.header('My room', '🛏️') : ''}<div class="card kid-card">Can’t reach the room right now.</div>`; return; }
    if (!d.configured) {
      el.innerHTML = `${title ? F.kids.header('My room', '🛏️') : ''}<div class="card kid-card center"><p>Nothing is set up for this room yet.</p></div>`;
      return;
    }
    const sleep = d.sleep;
    const mins = sleep ? Math.round(sleep.seconds / 60) : 0;
    el.innerHTML = `${title ? F.kids.header('My room', '🛏️') : ''}
      <div class="rm-grid">${Object.entries(d.controls).map(([k, c]) => `<button type="button" class="rm-btn" data-k="${esc(k)}" aria-pressed="${!!c.on}" ${c.available ? '' : 'disabled'}>
        <span class="em">${esc(c.emoji)}</span><b>${esc(c.label)}</b><span class="rm-state">${c.available ? (c.on ? 'On' : 'Off') : 'Asleep'}</span></button>`).join('')}</div>
      ${sleep ? `<div class="card kid-card"><h2>⏲️ Sleep timer</h2><p class="small muted">${mins ? `Stops in about ${mins} min.` : 'Stops the sound after a while.'}</p>
        <div class="km-chips">${sleep.chips.map((n) => `<button type="button" class="km-chip ${n && n === mins ? 'on' : ''}" data-min="${n}">${n ? (n >= 60 && n % 60 === 0 ? `${n / 60} hour${n > 60 ? 's' : ''}` : `${n} min`) : 'Off'}</button>`).join('')}</div></div>` : ''}`;
    el.querySelectorAll('.rm-btn').forEach((b) => b.onclick = async () => {
      const want = b.getAttribute('aria-pressed') !== 'true';
      b.disabled = true; b.setAttribute('aria-pressed', String(want)); b.querySelector('.rm-state').textContent = want ? 'On' : 'Off';
      try { await api(`/room/${encodeURIComponent(b.dataset.k)}`, { body: { on: want } }); }
      catch (e) { toast(e.message); b.setAttribute('aria-pressed', String(!want)); b.querySelector('.rm-state').textContent = want ? 'Off' : 'On'; }
      b.disabled = false;
      setTimeout(() => { if (document.body.contains(b)) draw(el, api, { title }); }, 2500);   // players take a moment to report back
    });
    el.querySelectorAll('[data-min]').forEach((c) => c.onclick = async () => {
      const n = +c.dataset.min;
      el.querySelectorAll('[data-min]').forEach((x) => x.classList.toggle('on', x === c && n > 0));
      try { await api('/room/timer/sleep', { body: { minutes: n } }); toast(n ? `⏲️ ${n} minutes` : 'Timer off'); } catch (e) { toast(e.message); }
    });
  }
  F.kroom = { draw };

  F.kids.register({ id: 'room', emoji: '🛏️', name: 'My room', colour: '#6b8bd6', order: 55, render: async (el) => {
    el.innerHTML = '<div class="kids" id="rm"></div>';
    await draw(el.querySelector('#rm'), F.kids.api);
  } });
})();
