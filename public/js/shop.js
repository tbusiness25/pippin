/* Shop, wardrobe, home decorating and companions. Everything is cosmetic. */
(function () {
  const { api, esc, toast } = F;
  const $app = document.getElementById('app');
  const SECTIONS = [['hat', '🎩 Hats'], ['neck', '🧣 Neck'], ['face', '👓 Face'], ['colour', '🎨 Colours'], ['furniture', '🛋️ Home'], ['companions', '🐌 Companions']];
  const SLOT_NAMES = { wall: 'Wall art', window: 'Window', floorL: 'Left corner', floorR: 'Right corner', rug: 'Rug', ceiling: 'Ceiling' };

  async function shop(section = 'hat') {
    F.setTab('me');
    const d = await api('/api/shop');
    const st = await F.refresh();
    const p = st.pet;
    const own = new Set(d.owned);
    const eq = d.equipped;
    const preview = section === 'furniture'
      ? Room.room(d.home, window.sprigOf(p, { mood: 'happy', size: 150 }), eq.companion ? Sprig.companion(eq.companion, 44) : '')
      : `<div class="center">${window.sprigOf(p, { mood: 'happy', size: 150 })}${eq.companion ? Sprig.companion(eq.companion, 40) : ''}</div>`;
    let body = '';
    if (section === 'companions') {
      body = `<p class="small muted">Tiny friends are earned, never bought. Tap one you have to bring it along.</p><div class="items">${d.companions.map((c) => `
        <button class="item ${eq.companion === c.id ? 'on' : ''}" ${c.owned ? `data-comp="${c.id}"` : 'disabled'} style="${c.owned ? '' : 'opacity:.45'}">
          ${Sprig.companion(c.id, 56)}<div><b>${esc(c.name)}</b></div><div class="small muted">${c.owned ? (eq.companion === c.id ? 'With you' : 'Tap to bring') : esc(c.how)}</div></button>`).join('')}</div>`;
    } else {
      const list = d.items.filter((i) => i.type === section);
      const groups = section === 'furniture' ? Object.keys(SLOT_NAMES).map((sl) => [SLOT_NAMES[sl], list.filter((i) => i.slot === sl)]) : [['', list]];
      body = groups.map(([title, items]) => `${title ? `<h3 style="margin-top:12px">${title}</h3>` : ''}<div class="items">${items.map((it) => {
        const has = own.has(it.id);
        const on = section === 'furniture' ? d.home[it.slot] === it.id : eq[section] === it.id;
        const cost = it.event ? `${it.price} ${d.event?.emoji || ''}` : `${it.price} 🌰`;
        return `<button class="item ${on ? 'on' : ''}" data-id="${it.id}" data-has="${has ? 1 : 0}">${Sprig.itemPreview(it, 64)}<div>${esc(it.name)}</div>
          <div class="price">${has ? (on ? 'Wearing' : 'Owned') : cost}</div></button>`;
      }).join('')}</div>`).join('');
    }
    $app.innerHTML = `
      <div class="topbar"><a href="#me" class="btn ghost" style="padding-left:0">‹ Me</a><span class="stat">🌰 ${d.acorns}</span>${d.event ? `<span class="stat">${d.event.emoji} ${d.event.tokens}</span>` : '<span></span>'}</div>
      ${d.event ? `<div class="banner small">${d.event.emoji} <b>${esc(d.event.name)}</b> — limited items appear in each section while it lasts.</div>` : ''}
      ${preview}
      <div class="tabs2">${SECTIONS.map(([k, n]) => `<button class="chip ${k === section ? 'on' : ''}" data-sec="${k}">${n}</button>`).join('')}</div>
      <div class="card">${body}${section !== 'companions' && section !== 'furniture' && eq[section] ? `<button class="btn ghost block" id="off">Take it off</button>` : ''}</div>`;

    $app.querySelectorAll('[data-sec]').forEach((b) => b.onclick = () => { location.hash = `#shop/${b.dataset.sec}`; });
    $app.querySelectorAll('[data-comp]').forEach((b) => b.onclick = async () => {
      await api('/api/shop/equip', { body: { slot: 'companion', id: eq.companion === b.dataset.comp ? null : b.dataset.comp } }); shop(section);
    });
    $app.querySelectorAll('[data-id]').forEach((b) => b.onclick = async () => {
      const it = d.items.find((x) => x.id === b.dataset.id);
      try {
        if (b.dataset.has !== '1') {
          if (!confirm(`Buy ${it.name} for ${it.event ? `${it.price} ${d.event.token}` : `${it.price} acorns`}?`)) return;
          await api(`/api/shop/buy/${it.id}`, { body: {} });
          toast(`${it.name} is yours!`);
        }
        if (it.type === 'furniture') {
          const on = d.home[it.slot] === it.id;
          await api('/api/shop/place', { body: { slot: it.slot, id: on ? null : it.id } });
        } else {
          await api('/api/shop/equip', { body: { slot: it.type, id: eq[it.type] === it.id ? null : it.id } });
        }
        shop(section);
      } catch (e) { toast(e.message); }
    });
    document.getElementById('off')?.addEventListener('click', async () => { await api('/api/shop/equip', { body: { slot: section, id: null } }); shop(section); });
  }

  F.routes.shop = (sub) => shop(sub === 'home' ? 'furniture' : (sub || 'hat'));
})();
