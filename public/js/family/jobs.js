/*
 * Family → a child → jobs & money panels: chores, stars & rewards, pocket money, feelings answers, wish list.
 * Every call goes to the child's own /api/kids endpoints as a parent (F.family.kapi adds ?child=).
 */
(function () {
  const { esc, toast, sheet } = F;
  const k = (child, path, opts) => F.family.kapi(child, path, opts);
  const m = (p) => (p < 0 ? '−' : '') + F.kids.money(Math.abs(p));
  const ago = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
  const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const isoWeek = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    return `${d.getFullYear()}-W${String(1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
  };
  // A tiny form in a sheet: fields = [[id, label, value, type]]
  function form(title, fields, onSave, extra = '') {
    sheet(`<h1>${esc(title)}</h1>${fields.map(([id, label, val, type]) => `<div class="field"><label for="f-${id}">${esc(label)}</label>
      <input id="f-${id}" ${type ? `type="${type}"` : ''} value="${esc(val ?? '')}"></div>`).join('')}${extra}<button class="btn block" id="f-save">Save</button>`,
    (sh, close) => sh.querySelector('#f-save').onclick = async () => {
      const v = Object.fromEntries(fields.map(([id]) => [id, sh.querySelector(`#f-${id}`).value.trim()]));
      try { await onSave(v, sh); close(); } catch (e) { toast(e.message); }
    });
  }

  // ---------- Chores ----------
  async function chores(el, child) {
    const [man, wk] = await Promise.all([k(child, '/chores/manage'), k(child, '/chores/week')]);
    const days = wk.chores_week[0]?.days || [];
    el.innerHTML = `<h1>⭐ ${esc(child.name)}’s jobs</h1>
      <div class="card"><h2>This week</h2>${wk.chores_week.length ? `<div class="kjp-grid" style="--n:${days.length}">
        <span></span>${days.map((d) => `<span class="small muted center">${esc(day(d.d).slice(0, 2))}</span>`).join('')}
        ${wk.chores_week.map((c) => `<span class="kjp-cname">${esc(c.icon_emoji || '·')} ${esc(c.title)}</span>${c.days.map((d) => `<span class="kjp-dot${d.done ? ' on' : ''}" title="${esc(d.d)}"></span>`).join('')}`).join('')}</div>` : '<p class="muted">No chores yet.</p>'}
        <div class="row wrap" style="margin-top:10px"><button class="btn secondary" id="rt">↺ Reset today</button><button class="btn ghost" id="rw">Reset this week</button></div>
        <p class="small muted">Resetting clears the ticks so jobs can be done again; stars already earned are kept.</p></div>
      <div class="card"><div class="row"><h2 class="grow">All jobs</h2><button class="btn" id="add">+ Add</button></div>
        ${man.chores.map((c) => `<div class="row kjp-row${c.active ? '' : ' off'}"><span>${esc(c.icon_emoji || '⭐')}</span>
          <span class="grow"><b>${esc(c.title)}</b><span class="small muted"> · ${esc(c.frequency)}${c.active ? '' : ' · removed'}</span></span><b>${c.star_value}⭐</b>
          <button class="btn ghost" data-edit="${c.id}" aria-label="Edit">✏️</button>
          ${c.active ? `<button class="btn ghost" data-del="${c.id}" aria-label="Remove">🗑</button>` : `<button class="btn ghost" data-restore="${c.id}">Restore</button>`}</div>`).join('')}</div>`;
    const reload = () => chores(el, child);
    const reset = (scope) => async () => { try { const r = await k(child, '/chores/reset', { body: { scope } }); toast(`Cleared ${r.cleared}`); reload(); } catch (e) { toast(e.message); } };
    el.querySelector('#rt').onclick = reset('today');
    el.querySelector('#rw').onclick = reset('week');
    const freqSel = (cur) => `<div class="field"><label for="f-freq">How often</label><select id="f-freq">${['daily', 'weekly', 'matchday', 'adhoc'].map((f) => `<option ${f === cur ? 'selected' : ''}>${f}</option>`).join('')}</select></div>`;
    el.querySelector('#add').onclick = () => form('New job', [['title', 'Job', ''], ['icon', 'Emoji', '⭐'], ['stars', 'Stars', '1', 'number']],
      async (v, sh) => { await k(child, '/chores', { body: { title: v.title, icon_emoji: v.icon, star_value: +v.stars || 1, frequency: sh.querySelector('#f-freq').value } }); reload(); }, freqSel('daily'));
    el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
      const c = man.chores.find((x) => x.id === b.dataset.edit);
      form('Edit job', [['title', 'Job', c.title], ['icon', 'Emoji', c.icon_emoji], ['stars', 'Stars', c.star_value, 'number'], ['desc', 'Description', c.description || '']],
        async (v, sh) => { await k(child, `/chores/${c.id}`, { method: 'PATCH', body: { title: v.title, icon_emoji: v.icon, star_value: +v.stars, description: v.desc, frequency: sh.querySelector('#f-freq').value } }); reload(); }, freqSel(c.frequency));
    });
    el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { await k(child, `/chores/${b.dataset.del}`, { method: 'DELETE' }); reload(); });
    el.querySelectorAll('[data-restore]').forEach((b) => b.onclick = async () => { await k(child, `/chores/${b.dataset.restore}`, { method: 'PATCH', body: { active: true } }); reload(); });
  }

  // ---------- Stars & rewards ----------
  const DEC = { pending: 'waiting', talk_first: 'talk first', approved: 'approved', declined: 'declined', completed: 'done' };
  async function rewards(el, child) {
    const [rq, man, led] = await Promise.all([k(child, '/rewards/requests'), k(child, '/rewards/manage'), k(child, '/stars/ledger')]);
    const open = rq.requests.filter((r) => ['pending', 'talk_first', 'approved'].includes(r.parent_decision));
    const past = rq.requests.filter((r) => !open.includes(r));
    el.innerHTML = `<h1>🏆 ${esc(child.name)}’s stars</h1>
      <div class="card row"><span style="font-size:2rem">⭐</span><b class="grow" style="font-size:1.6rem">${rq.balance}</b><button class="btn secondary" id="adj">+ Give stars</button></div>
      <div class="card"><h2>Asks to decide</h2>${open.length ? open.map((r) => `<div class="kjp-req">
          <div class="row"><span style="font-size:1.4rem">${esc(r.icon_emoji || '🎁')}</span><div class="grow"><b>${esc(r.reward_title)}</b>
          <div class="small muted">${r.stars_at_request} / ${r.stars_required} ⭐ · asked ${ago(r.requested_at)} · ${esc(DEC[r.parent_decision])}${r.parent_user ? ` by ${esc(r.parent_user)}` : ''}</div></div></div>
          <div class="row wrap">${r.parent_decision !== 'approved' ? `<button class="btn" data-d="approved" data-id="${r.id}">Approve</button>` : ''}
            <button class="btn secondary" data-d="completed" data-id="${r.id}">Done (spend ${r.stars_required}⭐)</button>
            ${r.parent_decision !== 'talk_first' ? `<button class="btn ghost" data-d="talk_first" data-id="${r.id}">Talk first</button>` : ''}
            <button class="btn ghost" data-d="declined" data-id="${r.id}">Not now</button></div></div>`).join('') : '<p class="muted small">Nothing waiting.</p>'}
        <p class="small muted">Stars are only spent when you mark a reward done.</p></div>
      <div class="card"><div class="row"><h2 class="grow">Rewards</h2><button class="btn" id="addr">+ Add</button></div>
        ${man.rewards.map((r) => `<div class="row kjp-row${r.active ? '' : ' off'}"><span>${esc(r.icon_emoji || '🎁')}</span><span class="grow"><b>${esc(r.title)}</b>${r.active ? '' : ' <span class="small muted">· removed</span>'}</span>
          <b>${r.stars_required}⭐</b><button class="btn ghost" data-er="${r.id}" aria-label="Edit">✏️</button>
          ${r.active ? `<button class="btn ghost" data-xr="${r.id}" aria-label="Remove">🗑</button>` : `<button class="btn ghost" data-rr="${r.id}">Restore</button>`}</div>`).join('')}</div>
      ${past.length ? `<div class="card"><h2>Recent decisions</h2>${past.slice(0, 8).map((r) => `<div class="small">${esc(r.icon_emoji || '🎁')} ${esc(r.reward_title)} — <b>${esc(DEC[r.parent_decision] || r.parent_decision)}</b>${r.parent_user ? ` by ${esc(r.parent_user)}` : ''} · ${ago(r.parent_decision_at || r.requested_at)}</div>`).join('')}</div>` : ''}
      <div class="card"><h2>Star history</h2>${led.ledger.slice(0, 15).map((l) => `<div class="row small"><span class="muted">${esc(l.source)}</span><span class="grow">${esc(l.note || '')}</span><b>${l.stars > 0 ? '+' : ''}${l.stars}⭐</b></div>`).join('') || '<p class="muted small">None yet.</p>'}</div>`;
    const reload = () => rewards(el, child);
    el.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => {
      const go = async (note) => { try { await k(child, `/rewards/requests/${b.dataset.id}/decide`, { body: { decision: b.dataset.d, note } }); reload(); } catch (e) { toast(e.message); } };
      if (b.dataset.d === 'declined' || b.dataset.d === 'talk_first') form('A note for them (optional)', [['note', 'Note', '']], (v) => go(v.note || undefined));
      else go();
    });
    el.querySelector('#adj').onclick = () => form('Give stars', [['stars', 'Stars', '1', 'number'], ['note', 'What for?', '']],
      async (v) => { await k(child, '/stars/adjust', { body: { stars: +v.stars, note: v.note || undefined } }); reload(); });
    el.querySelector('#addr').onclick = () => form('New reward', [['title', 'Reward', ''], ['icon', 'Emoji', '🎁'], ['stars', 'Stars needed', '20', 'number']],
      async (v) => { await k(child, '/rewards', { body: { title: v.title, icon_emoji: v.icon, stars_required: +v.stars } }); reload(); });
    el.querySelectorAll('[data-er]').forEach((b) => b.onclick = () => {
      const r = man.rewards.find((x) => x.id === b.dataset.er);
      form('Edit reward', [['title', 'Reward', r.title], ['icon', 'Emoji', r.icon_emoji], ['stars', 'Stars needed', r.stars_required, 'number']],
        async (v) => { await k(child, `/rewards/${r.id}`, { method: 'PATCH', body: { title: v.title, icon_emoji: v.icon, stars_required: +v.stars } }); reload(); });
    });
    el.querySelectorAll('[data-xr]').forEach((b) => b.onclick = async () => { await k(child, `/rewards/${b.dataset.xr}`, { method: 'DELETE' }); reload(); });
    el.querySelectorAll('[data-rr]').forEach((b) => b.onclick = async () => { await k(child, `/rewards/${b.dataset.rr}`, { method: 'PATCH', body: { active: true } }); reload(); });
  }

  // ---------- Pocket money ----------
  async function money(el, child) {
    const d = await k(child, '/money/parent');
    const pending = d.payouts.filter((p) => p.status === 'pending');
    el.innerHTML = `<h1>🐷 ${esc(child.name)}’s money</h1>
      <div class="card"><div class="kjp-money"><div><b>${m(d.total)}</b><span>total</span></div><div><b>${m(d.spendable)}</b><span>to spend</span></div><div><b>${m(d.earmarked)}</b><span>in jars</span></div></div></div>
      ${pending.length ? `<div class="card"><h2>Wants to buy</h2>${pending.map((p) => `<div class="kjp-req"><div class="row"><span style="font-size:1.4rem">${esc(p.icon_emoji || '🛒')}</span>
        <div class="grow"><b>${esc(p.goal_title || 'Pocket money')}</b><div class="small muted">${m(p.amount_pence)} · asked ${ago(p.requested_at)}</div></div></div>
        <div class="row wrap"><button class="btn" data-pay="${p.id}" data-d="approved">Yes — spend ${m(p.amount_pence)}</button><button class="btn ghost" data-pay="${p.id}" data-d="declined">Not now</button></div></div>`).join('')}</div>` : ''}
      <div class="card"><h2>Weekly pocket money</h2>
        <div class="row wrap"><button class="btn" id="pay">Pay this week (${m(d.allowance_pence)})</button><button class="btn ghost" id="amt">Change amount</button></div>
        <p class="small muted">Paying twice in the same week is ignored (week ${esc(isoWeek())}). An automation can pay it too.</p>
        <div class="row wrap" style="margin-top:8px"><input id="adj" type="number" placeholder="± pence" style="max-width:120px"><input id="adjn" placeholder="Note (optional)" style="flex:1;min-width:140px;width:auto"><button class="btn secondary" id="adjb">Adjust</button></div></div>
      <div class="card"><h2>Jars</h2>${d.goals.map((g) => `<div class="row kjp-row"><span>${esc(g.icon_emoji || '🐷')}</span><span class="grow"><b>${esc(g.title)}</b>
        <span class="small muted"> · ${g.target_pence ? `${m(g.saved_pence)} of ${m(g.target_pence)}` : `${m(g.saved_pence)} saved`}${g.created_by === 'parent' ? ' · by a parent' : ''}</span></span></div>`).join('')}</div>
      <div class="card"><h2>History</h2>${d.ledger.map((l) => `<div class="row small"><span class="muted">${esc(new Date(l.created_at).toLocaleDateString('en-GB'))}</span><span class="grow">${esc(l.note || l.source)}</span><b>${l.pence >= 0 ? '+' : ''}${m(l.pence)}</b></div>`).join('') || '<p class="muted small">None yet.</p>'}</div>
      ${d.payouts.filter((p) => p.status !== 'pending').length ? `<div class="card"><h2>Past spends</h2>${d.payouts.filter((p) => p.status !== 'pending').map((p) => `<div class="small">${esc(p.goal_title || '')} ${m(p.amount_pence)} — <b>${esc(p.status)}</b>${p.parent_user ? ` by ${esc(p.parent_user)}` : ''}</div>`).join('')}</div>` : ''}`;
    const reload = () => money(el, child);
    el.querySelector('#pay').onclick = async () => {
      try { const r = await k(child, '/money/allowance', { body: { ref: `wk-${isoWeek()}` } }); toast(r.skipped ? 'Already paid this week' : `Paid ${m(r.credited)} 💷`); reload(); } catch (e) { toast(e.message); }
    };
    el.querySelector('#amt').onclick = () => form('Weekly amount', [['p', 'Pounds', (d.allowance_pence / 100).toFixed(2), 'number']],
      async (v) => { await k(child, '/money/settings', { body: { allowance_pence: Math.round(parseFloat(v.p) * 100) } }); reload(); });
    el.querySelector('#adjb').onclick = async () => {
      const p = parseInt(el.querySelector('#adj').value, 10); if (!p) return;
      try { await k(child, '/money/adjust', { body: { pence: p, note: el.querySelector('#adjn').value.trim() || undefined } }); toast('Saved'); reload(); } catch (e) { toast(e.message); }
    };
    el.querySelectorAll('[data-pay]').forEach((b) => b.onclick = async () => {
      try { await k(child, `/money/payouts/${b.dataset.pay}/decide`, { body: { decision: b.dataset.d } }); reload(); } catch (e) { toast(e.message); }
    });
  }

  // ---------- Feelings answers ----------
  async function care(el, child) {
    const [r, pr] = await Promise.all([k(child, '/care/responses?days=60'), k(child, '/care/prompts')]);
    el.innerHTML = `<h1>💛 ${esc(child.name)}’s feelings answers</h1>
      ${r.responses.map((x) => `<div class="card kjp-care${x.difficult_feelings ? ' flag' : ''}">
        <div class="small muted">${esc(x.category)} · ${ago(x.responded_at)}${x.difficult_feelings ? ' · <b>💛 worth a gentle chat</b>' : ''}</div>
        <div class="small"><i>${esc(x.prompt_text)}</i></div><p>${esc(x.response_text)}</p>
        ${x.parent_seen_at ? `<div class="small muted">Seen ${ago(x.parent_seen_at)}</div>` : `<button class="btn secondary" data-seen="${x.id}">Mark seen</button>`}</div>`).join('')
        || '<div class="card"><p class="muted">No answers yet.</p></div>'}
      <div class="card"><div class="row"><h2 class="grow">Questions</h2><button class="btn ghost" id="addq">+ Add</button></div>
        <p class="small muted">One a day, in rotation.</p>
        ${pr.prompts.map((p) => `<label class="row kjp-row"><input type="checkbox" data-q="${p.id}" ${p.active ? 'checked' : ''} style="width:22px;height:22px"><span class="grow small">${esc(p.prompt_text)}</span></label>`).join('')}</div>`;
    const reload = () => care(el, child);
    el.querySelectorAll('[data-seen]').forEach((b) => b.onclick = async () => { await k(child, `/care/responses/${b.dataset.seen}/seen`, { body: {} }); reload(); });
    el.querySelectorAll('[data-q]').forEach((cb) => cb.onchange = async () => { await k(child, `/care/prompts/${cb.dataset.q}`, { method: 'PATCH', body: { active: cb.checked } }); toast('Saved'); });
    el.querySelector('#addq').onclick = () => form('New question', [['q', 'Question', '']], async (v) => { await k(child, '/care/prompts', { body: { prompt_text: v.q } }); reload(); });
  }

  // ---------- Wish list ----------
  const WL = { pending: 'new', planned: 'planned', done: 'done', not_this_time: 'not this time', talk_first: 'talk first' };
  async function summer(el, child) {
    const d = await k(child, '/summer');
    const open = d.items.filter((w) => w.parent_decision === 'pending' || w.parent_decision === 'talk_first');
    const rest = d.items.filter((w) => !open.includes(w));
    const row = (w) => `<div class="card kjp-req"><b>☀️ ${esc(w.title)}</b>${w.note ? `<div class="small">${esc(w.note)}</div>` : ''}
      <div class="small muted">added ${ago(w.created_at)} · ${esc(WL[w.parent_decision] || w.parent_decision)}${w.planned_date ? ` · 📅 ${esc(day(w.planned_date))}` : ''}${w.parent_user ? ` · by ${esc(w.parent_user)}` : ''}</div>
      <div class="row wrap">${w.parent_decision !== 'done' ? `<button class="btn" data-plan="${w.id}">${w.parent_decision === 'planned' ? 'Change date' : 'Plan it'}</button><button class="btn secondary" data-w="done" data-id="${w.id}">Done</button>` : ''}
        ${open.includes(w) ? `${w.parent_decision !== 'talk_first' ? `<button class="btn ghost" data-w="talk_first" data-id="${w.id}">Talk about it</button>` : ''}<button class="btn ghost" data-w="not_this_time" data-id="${w.id}">Not this time</button>` : ''}</div></div>`;
    el.innerHTML = `<h1>☀️ ${esc(child.name)}’s wish list</h1>
      ${open.length ? `<h2>New ideas (${open.length})</h2>${open.map(row).join('')}` : '<div class="card"><p class="muted">No new ideas waiting.</p></div>'}
      ${rest.length ? `<h2>Decided</h2>${rest.slice(0, 20).map(row).join('')}` : ''}`;
    const reload = () => summer(el, child);
    const decide = async (id, decision, extra = {}) => {
      try { const r = await k(child, `/summer/${id}/decide`, { body: { decision, ...extra } }); if (r.calendar_event_id) toast('📅 Added to the family calendar'); reload(); }
      catch (e) { toast(e.message); }
    };
    el.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => {
      if (b.dataset.w === 'done') return decide(b.dataset.id, 'done');
      form('A note for them (optional)', [['note', 'Note', '']], (v) => decide(b.dataset.id, b.dataset.w, { note: v.note || undefined }));
    });
    el.querySelectorAll('[data-plan]').forEach((b) => b.onclick = () => {
      const w = d.items.find((x) => x.id === b.dataset.plan);
      form('When?', [['date', 'Date (leave blank if not sure yet)', w.planned_date || '', 'date']],
        (v) => decide(w.id, 'planned', { planned_date: v.date || undefined }),
        '<p class="small muted">With a date it also goes on the family calendar.</p>');
    });
  }

  const P = F.family.childPanel;
  P({ id: 'jobs', module: 'chores', emoji: '⭐', name: 'Jobs', sub: 'Chores and this week', order: 10, render: chores });
  P({ id: 'rewards', module: 'stars', emoji: '🏆', name: 'Stars & rewards', sub: 'Approve asks', order: 12, render: rewards });
  P({ id: 'money', module: 'money', emoji: '🐷', name: 'Pocket money', sub: 'Allowance, jars, spends', order: 14, render: money });
  P({ id: 'care', module: 'care', emoji: '💛', name: 'Feelings answers', sub: 'Daily question', order: 16, render: care });
  P({ id: 'summer', module: 'summer', emoji: '☀️', name: 'Wish list', sub: 'Things they’d love to do', order: 18, render: summer });
})();
