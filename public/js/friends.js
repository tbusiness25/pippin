/* Friends: codes, kind words, visiting homes, shared goals, gifts. */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const LEVEL_NAMES = ['New friends', 'Pals', 'Good pals', 'Close', 'Very close', 'Firm friends', 'Old friends', 'Best buds', 'Kindred spirits', 'Soulmates'];

  async function friends(sub) {
    F.setTab('friends');
    if (sub && sub.startsWith('visit:')) return visit(sub.slice(6));
    const d = await api('/api/social/friends');
    $app.innerHTML = `<h1>Friends</h1>
      <div class="card"><div class="row"><div class="grow"><div class="small muted">Your friend code</div><div style="font-family:var(--display);font-size:1.6rem;letter-spacing:.12em">${esc(d.code)}</div></div>
        <button class="btn secondary" id="share">Share</button></div>
        <div class="row" style="margin-top:12px"><input id="code" placeholder="Friend’s code" maxlength="8" style="text-transform:uppercase"><button class="btn" id="add">Add</button></div>
        <p class="small muted" style="margin:.6em 0 0">Friends can see your sprig and its home, and shared goals. Never your check-ins, notes, chats or other goals.</p></div>
      <div class="card"><h2>Your friends</h2>${d.friends.length ? d.friends.map((f) => `
        <div class="friend"><div style="width:56px">${f.pet_name ? Sprig.sprig({ colour: f.colour, stage: f.stage, equipped: f.equipped, mood: 'happy', size: 56 }) : '🥚'}</div>
          <div class="grow"><b>${esc(f.name)}</b><div class="small muted">${f.pet_name ? esc(f.pet_name) + ' · ' : ''}${LEVEL_NAMES[f.level - 1] || ''}</div></div>
          <button class="btn ${f.sent_today ? 'ghost' : 'secondary'}" data-k="${f.id}" ${f.sent_today ? 'disabled' : ''}>${f.sent_today ? 'Sent 💛' : 'Kind word'}</button>
          <button class="btn ghost" data-more="${f.id}" aria-label="More">⋯</button></div>`).join('') : '<p class="muted">Add someone with their code. Anyone on this server can be a friend.</p>'}</div>
      <div class="card"><h2>Kind words you’ve had</h2>${d.inbox.length ? d.inbox.map((k) => { const kk = d.kindnesses.find((x) => x.id === k.kind) || {};
        return `<div class="row small" style="padding:6px 0"><span>${kk.emoji || '💛'}</span><span class="grow"><b>${esc(k.from_name)}</b>: ${esc(kk.text || '')}</span><span class="muted">${new Date(k.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>`; }).join('') : '<p class="muted small">None yet.</p>'}</div>`;

    document.getElementById('add').onclick = async () => {
      try { const r = await api('/api/social/friends', { body: { code: document.getElementById('code').value } }); toast(`You and ${r.name} are friends now 💛`); friends(); }
      catch (e) { toast(e.message); }
    };
    document.getElementById('share').onclick = async () => {
      const text = `Be my friend on ${APP}! My code is ${d.code}`;
      if (navigator.share) navigator.share({ text }).catch(() => {}); else { navigator.clipboard?.writeText(d.code); toast('Code copied'); }
    };
    $app.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
      const f = d.friends.find((x) => x.id === b.dataset.k);
      sheet(`<h1>Send ${esc(f.name)} a kind word</h1><div class="grid">${d.kindnesses.map((k) => `<button class="tile" data-kind="${k.id}" style="min-height:0"><span class="em">${k.emoji}</span><span>${esc(k.text)}</span></button>`).join('')}</div>`,
        (sh, close) => sh.querySelectorAll('[data-kind]').forEach((kb) => kb.onclick = async () => {
          try { const r = await api(`/api/social/friends/${f.id}/kindness`, { body: { kind: kb.dataset.kind } }); close(); toast(`Sent to ${f.name} 💛`); F.showMessages(r.messages); if (r.energy?.started) F.afterEnergy(r.energy); friends(); }
          catch (e) { toast(e.message); }
        }));
    });
    $app.querySelectorAll('[data-more]').forEach((b) => b.onclick = () => {
      const f = d.friends.find((x) => x.id === b.dataset.more);
      sheet(`<h1>${esc(f.name)}</h1>
        <a class="btn block" href="#friends/visit:${f.id}" id="v" style="text-align:center;text-decoration:none">🏡 Visit ${esc(f.pet_name || 'their home')}</a><div style="height:10px"></div>
        <button class="btn secondary block" id="sg">🤝 Start a shared goal</button><div style="height:10px"></div>
        <button class="btn secondary block" id="gift">🎁 Send a gift</button><div style="height:10px"></div>
        <button class="btn ghost block" id="rm">Remove friend</button>`, (sh, close) => {
        sh.querySelector('#v').onclick = close;
        sh.querySelector('#sg').onclick = () => { close(); sharedGoal(f); };
        sh.querySelector('#gift').onclick = () => { close(); gift(f); };
        sh.querySelector('#rm').onclick = async () => { if (confirm(`Remove ${f.name} as a friend?`)) { await api(`/api/social/friends/${f.id}`, { method: 'DELETE' }); close(); friends(); } };
      });
    });
  }

  function sharedGoal(f) {
    sheet(`<h1>A goal with ${esc(f.name)}</h1><p class="muted">You’ll both get it every day, and see when the other has done it.</p>
      <div class="field"><label for="t">What will you both do?</label><input id="t" maxlength="80" placeholder="e.g. 10-minute walk"></div>
      <button class="btn block" id="ok">Start it</button>`, (sh, close) => sh.querySelector('#ok').onclick = async () => {
      try { await api(`/api/social/friends/${f.id}/shared-goal`, { body: { title: sh.querySelector('#t').value } }); close(); toast('Shared goal added for you both'); }
      catch (e) { toast(e.message); }
    });
  }

  async function gift(f) {
    const d = await api('/api/shop');
    const items = d.items.filter((i) => !i.event && i.type !== 'colour');
    sheet(`<h1>A gift for ${esc(f.name)}</h1><p class="small muted">Paid with your acorns (you have ${d.acorns}).</p>
      <div class="items">${items.map((it) => `<button class="item" data-g="${it.id}">${Sprig.itemPreview(it, 56)}<div>${esc(it.name)}</div><div class="price">${it.price} 🌰</div></button>`).join('')}</div>`,
    (sh, close) => sh.querySelectorAll('[data-g]').forEach((b) => b.onclick = async () => {
      try { await api(`/api/social/friends/${f.id}/gift`, { body: { item: b.dataset.g } }); close(); toast(`🎁 Sent to ${f.name}!`); }
      catch (e) { toast(e.message); }
    }));
  }

  async function visit(id) {
    const d = await api(`/api/social/friends/${id}/visit`);
    const p = d.pet;
    $app.innerHTML = `<a href="#friends" class="btn ghost" style="padding-left:0">‹ Friends</a>
      <h1>${esc(p ? p.name : d.name)}’s home</h1>
      ${p ? `${p.away ? `<div class="card center">🎒 ${esc(p.name)} is out at ${esc(p.away)} right now.</div>` : Room.room(p.home, Sprig.sprig({ colour: p.colour, stage: p.stage, equipped: p.equipped, mood: 'happy', size: 150 }), p.equipped?.companion ? Sprig.companion(p.equipped.companion, 44) : '')}
        <div class="card"><p><b>${esc(d.name)}</b>’s ${esc(p.stageName.toLowerCase())} · ${p.adventures} adventures${p.companions.length ? ` · with ${esc(p.companions.join(', '))}` : ''}</p>
        ${p.lastAdventure ? `<p class="small muted">Last adventure: “${esc(p.lastAdventure.title)}” at ${esc(p.lastAdventure.place)}</p>` : ''}</div>` : `<div class="card">${esc(d.name)} hasn’t hatched their egg yet.</div>`}`;
  }

  F.routes.friends = friends;
})();
