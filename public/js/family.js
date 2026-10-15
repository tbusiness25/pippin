/*
 * Family (adults): the household's children for parents, plus shared things — the family calendar
 * and anything else a module adds.
 *   F.family.section({ id, emoji, name, order, parentsOnly, render(el, rest) })  → a tile on the Family page (#family/<id>)
 *   F.family.childPanel({ id, emoji, name, order, render(el, child, rest) })     → a panel for each child (#family/child/<childId>/<id>)
 * Child panels call the child's own /api/kids endpoints as a parent with F.family.kapi(child, path, opts).
 */
(function () {
  const { api, esc, toast, sheet } = F;
  const $app = document.getElementById('app');
  const sections = {}, panels = {};
  const sorted = (o) => Object.values(o).sort((a, b) => (a.order || 50) - (b.order || 50));
  const kapi = (child, path, opts) => api(`/api/kids${path}${path.includes('?') ? '&' : '?'}child=${encodeURIComponent(child.id || child)}`, opts);
  const back = (href, label) => `<a href="${href}" class="btn ghost" style="padding-left:0">‹ ${esc(label)}</a>`;

  async function page(rest = '') {
    F.setTab('family');
    const [key, ...more] = rest.split('/');
    const st = F.state;
    if (key === 'child') return childPage(more[0], more.slice(1).join('/'));
    if (key && sections[key]) {
      $app.innerHTML = `${back('#family', 'Family')}<div id="fam"></div>`;
      return sections[key].render(document.getElementById('fam'), more.join('/'));
    }
    const isParent = st.user.isParent;
    const { children } = isParent ? await api('/api/family/children') : { children: [] };
    $app.innerHTML = `<h1>👪 Family</h1>
      ${isParent ? `<div class="card"><div class="row"><h2 class="grow">Children</h2><button class="btn ghost" id="addKid">+ Add</button></div>
        ${children.length ? children.map((c) => `<a class="friend" href="#family/child/${c.id}" style="text-decoration:none;color:inherit">
          <span>${c.pet_name ? sprigOf({ colour: c.colour, stage: null, equipped: c.equipped }, { size: 46 }) : '🥚'}</span>
          <div class="grow"><b>${esc(c.name)}</b><div class="small muted">${c.pet_name ? `${esc(c.pet_name)} · ${c.adventures} adventures · 🌰 ${c.acorns}` : 'Hasn’t hatched a sprig yet'}</div></div><span>›</span></a>`).join('')
        : '<p class="muted small">Add a child to give them their own kid-friendly app with a sprig to look after.</p>'}</div>` : ''}
      <div class="grid">${sorted(sections).filter((s) => !s.parentsOnly || isParent).map((s) => `<a class="tile" href="#family/${s.id}"><span class="em">${s.emoji}</span><b>${esc(s.name)}</b>${s.sub ? `<span class="small muted">${esc(s.sub)}</span>` : ''}</a>`).join('')}</div>`;
    document.getElementById('addKid')?.addEventListener('click', () => sheet(`<h1>Add a child</h1>
      <p class="small muted">They get their own kid-friendly ${esc(APP)} with a sprig to hatch. No coach, no web, nothing grown-up.</p>
      <div class="field"><label for="kn">Name</label><input id="kn" maxlength="40"></div>
      <div class="field"><label for="kp">Their PIN (4–8 digits)</label><input id="kp" inputmode="numeric" maxlength="8"></div>
      <button class="btn block" id="ok">Add</button>`, (sh, close) => sh.querySelector('#ok').onclick = async () => {
      try { await api('/api/family/children', { body: { name: sh.querySelector('#kn').value, pin: sh.querySelector('#kp').value } }); close(); toast('Added'); page(); }
      catch (e) { toast(e.message); }
    }));
  }

  async function childPage(id, rest) {
    const { children } = await api('/api/family/children');
    const child = children.find((c) => c.id === id);
    if (!child) { location.hash = '#family'; return; }
    const [pid, ...more] = (rest || '').split('/');
    if (pid && panels[pid]) {
      $app.innerHTML = `${back(`#family/child/${id}`, child.name)}<div id="fam"></div>`;
      return panels[pid].render(document.getElementById('fam'), child, more.join('/'));
    }
    const all = ((await kapi(child, '/me').catch(() => null)) || {}).modules || [];
    $app.innerHTML = `${back('#family', 'Family')}<h1>${esc(child.name)}</h1>
      <div class="grid">${sorted(panels).filter((p) => !p.hidden && (!p.module || all.includes(p.module))).map((p) => `<a class="tile" href="#family/child/${id}/${p.id}"><span class="em">${p.emoji}</span><b>${esc(p.name)}</b>${p.sub ? `<span class="small muted">${esc(p.sub)}</span>` : ''}</a>`).join('')}
        <a class="tile" href="#family/child/${id}/switches"><span class="em">🎛️</span><b>What ${esc(child.name)} sees</b><span class="small muted">Turn sections on or off</span></a></div>`;
  }

  // Built-in panel: switch a child's modules on/off.
  panels.switches = { id: 'switches', emoji: '🎛️', name: 'What they see', order: 999, hidden: true, async render(el, child) {
    const r = await kapi(child, '/settings', { body: {} });
    const off = new Set(r.off);
    const names = Object.fromEntries(Object.values(F.kids.modules).map((m) => [m.id, `${m.emoji} ${m.name}`]));
    el.innerHTML = `<h1>What ${esc(child.name)} sees</h1><div class="card">${r.all.map((m) => `<label class="row" style="padding:8px 0"><input type="checkbox" data-m="${m}" ${off.has(m) ? '' : 'checked'} style="width:22px;height:22px"><span>${esc(names[m] || m)}</span></label>`).join('')}</div>`;
    el.querySelectorAll('[data-m]').forEach((cb) => cb.onchange = async () => {
      cb.checked ? off.delete(cb.dataset.m) : off.add(cb.dataset.m);
      await kapi(child, '/settings', { body: { off: [...off] } }); toast('Saved');
    });
  } };

  F.family = {
    section(s) { sections[s.id] = s; },
    childPanel(p) { panels[p.id] = p; },
    kapi, back,
  };
  F.routes.family = page;
})();
