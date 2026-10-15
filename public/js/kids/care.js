/* Kids: today's feelings question. One gentle question a day; answering earns 2 stars. */
(function () {
  const { esc, toast } = F;

  async function render(el) {
    const d = await F.kids.api('/care/today');
    if (!d.prompt) {
      el.innerHTML = `<div class="kids">${F.kids.header('How am I?', '💛')}<div class="card kid-card center"><p>No question today. Come back tomorrow!</p></div></div>`;
      return;
    }
    el.innerHTML = `<div class="kids">${F.kids.header('How am I?', '💛')}
      <div class="card kid-card kj-care"><p class="kj-prompt">${esc(d.prompt.prompt_text)}</p>
      ${d.answered_today && d.response ? `<div class="kj-echo"><div class="small muted">You shared today</div><p>${esc(d.response.response_text)}</p></div>
        <p class="muted">Thank you for sharing. Your grown-ups will see it later. A new question comes tomorrow. 💛</p>`
      : `<textarea id="ans" class="kj-answer" maxlength="2000" rows="5" placeholder="Write here…" aria-label="Your answer"></textarea>
        <button class="btn block big" id="share">Share 💛 <span class="small">(+2 ⭐)</span></button>`}</div></div>`;
    const btn = el.querySelector('#share');
    if (btn) btn.onclick = async () => {
      const text = el.querySelector('#ans').value.trim();
      if (!text) { toast('Write a little something first'); return; }
      btn.disabled = true;
      try { const r = await F.kids.api('/care/respond', { body: { response_text: text } }); F.kids.celebrate(r); render(el); }
      catch (e) { toast(e.message); btn.disabled = false; }
    };
  }

  F.kids.register({ id: 'care', emoji: '💛', name: 'How am I?', short: 'Feelings', colour: '#e58fa8', order: 15, tab: false,
    badge: async () => ((await F.kids.api('/care/today')).answered_today ? '' : '1'),
    render });
})();
