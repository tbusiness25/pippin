/*
 * Family → Monitoring: keep a simple record of scores from official questionnaires, and watch the trend.
 * Pippin doesn't include the questionnaires themselves (their publishers ask for permission before they're reproduced
 * in apps). Fill in the official form, then enter the score here.
 */
(function () {
  const { api, esc, toast } = F;
  const kapi = (c, p, o) => F.family.kapi(c, p, o);

  F.family.childPanel({ id: 'monitor', emoji: '📈', name: 'Monitoring', order: 32, render: monitorPanel });

  async function monitorPanel(el, child) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    const d = await kapi(child, '/monitor');
    const today = new Date().toISOString().slice(0, 10);
    const byMeasure = {};
    for (const e of d.entries) (byMeasure[e.measure] = byMeasure[e.measure] || []).push(e);
    el.innerHTML = `<div class="card"><h2 style="margin-top:0">Watching how things change</h2>
        <p class="small muted">Keep a record each term, not each week. The official forms are the proper tools for this:</p>
        <ul class="small">
          <li><b>SDQ</b> (Strengths and Difficulties Questionnaire) — free UK questionnaire for parents and teachers, at <a href="https://www.sdqinfo.org" target="_blank" rel="noopener">sdqinfo.org</a>. Its terms ask that you don’t change or re-host it, so download it from there.</li>
          <li><b>Vanderbilt</b> ADHD parent and teacher forms — free from NICHQ (search “NICHQ Vanderbilt Assessment Scales”). Look up the scoring instructions on the same page.</li>
        </ul>
        <p class="small muted">A score here isn’t a diagnosis. It just helps you see whether things are getting easier, staying the same or getting harder, and it’s a useful thing to take to school or the GP if you ever want to.</p></div>
      <div class="card"><h2 style="margin-top:0">Add a score</h2>
        <div class="inline"><label class="fld"><span>Questionnaire</span><select id="mMeasure">${Object.entries(d.measures).map(([k, m]) => `<option value="${k}">${esc(m.label)}</option>`).join('')}</select></label>
          <label class="fld"><span>Score</span><input id="mScore" type="number" step="1" min="0"></label></div>
        <div class="inline"><label class="fld"><span>Date</span><input id="mDay" type="date" value="${today}" max="${today}"></label>
          <label class="fld"><span>Who filled it in</span><select id="mSource"><option value="parent">Me (parent)</option><option value="teacher">Teacher</option></select></label></div>
        <label class="fld"><span>Note (optional)</span><input id="mNote" maxlength="500" placeholder="e.g. after half-term; school says he’s doing well"></label>
        <button class="btn" id="mSave">Save score</button>
        <p class="small muted" id="mHelp"></p></div>
      ${Object.keys(byMeasure).map((k) => trend(d.measures[k], byMeasure[k], k)).join('') || '<div class="card"><p class="muted">No scores yet.</p></div>'}`;
    const help = () => { el.querySelector('#mHelp').textContent = d.measures[el.querySelector('#mMeasure').value].help; };
    el.querySelector('#mMeasure').onchange = help; help();
    el.querySelector('#mSave').onclick = async () => {
      try {
        await kapi(child, '/monitor', { method: 'POST', body: { measure: el.querySelector('#mMeasure').value, score: el.querySelector('#mScore').value,
          day: el.querySelector('#mDay').value, source: el.querySelector('#mSource').value, note: el.querySelector('#mNote').value } });
        toast('Saved'); monitorPanel(el, child);
      } catch (e) { toast(e.message); }
    };
    el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => { if (!confirm('Remove this score?')) return; await kapi(child, `/monitor/${b.dataset.del}`, { method: 'DELETE' }); monitorPanel(el, child); }; });
  }

  function trend(m, list, key) {
    const W = 320, H = 110, L = 28, B = 18, max = Math.max(m.max === 999 ? 0 : m.max, ...list.map((x) => x.score), 1);
    const t0 = new Date(list[0].day).getTime(), t1 = new Date(list[list.length - 1].day).getTime() || t0 + 1;
    const x = (e) => L + ((new Date(e.day).getTime() - t0) / (t1 - t0 || 1)) * (W - L - 6) * (list.length > 1 ? 1 : 0) + (list.length > 1 ? 0 : (W - L) / 2);
    const y = (v) => 6 + (1 - v / max) * (H - 6 - B);
    const pts = list.map((e) => `${x(e).toFixed(1)},${y(e.score).toFixed(1)}`).join(' ');
    return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">${esc(m.label)}</h2><span class="small muted">${list.length} record${list.length === 1 ? '' : 's'}</span></div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(m.label)} over time" style="margin-top:8px">
        <line x1="${L}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>
        ${list.length > 1 ? `<polyline points="${pts}" fill="none" stroke="var(--moss)" stroke-width="2"/>` : ''}
        ${list.map((e) => `<circle cx="${x(e).toFixed(1)}" cy="${y(e.score).toFixed(1)}" r="4" fill="${e.source === 'teacher' ? 'var(--sky)' : 'var(--moss)'}"><title>${esc(e.day)}: ${e.score}${e.note ? ` — ${esc(e.note)}` : ''}</title></circle>`).join('')}
        <text x="2" y="${y(max) + 4}" font-size="10" fill="var(--muted)">${max}</text><text x="2" y="${y(0) - 2}" font-size="10" fill="var(--muted)">0</text></svg>
      <table class="small" style="width:100%;margin-top:6px">${list.slice().reverse().map((e) => `<tr><td>${esc(e.day)}</td><td><b>${e.score}</b></td><td class="muted">${e.source === 'teacher' ? '🏫 teacher' : 'parent'}</td><td>${esc(e.note || '')}</td><td><button class="ghost" data-del="${e.id}" aria-label="Remove">✕</button></td></tr>`).join('')}</table></div>`;
  }
})();
