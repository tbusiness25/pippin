/* Kids: a one-time "What's new" tour, shown on the kids home the first time a child opens this version.
 * Pages only mention modules the child actually has switched on. Bump VERSION to show a new tour. */
(function () {
  const { esc, sheet } = F;
  const VERSION = '2026-10-family';
  const key = (childId) => `pippin-kids-whatsnew:${VERSION}:${childId}`;
  const seen = (id) => { try { return !!localStorage.getItem(key(id)); } catch (_) { return false; } };
  const markSeen = (id) => { try { localStorage.setItem(key(id), '1'); } catch (_) { /* private mode: shows again, harmless */ } };

  function pages(me, pet) {
    const has = (m) => me.modules.includes(m);
    const sprig = esc(pet?.name || 'your sprig');
    const out = [{
      em: '🌱', title: `Welcome to your new app, ${esc(me.child.name)}!`,
      body: `<p>Everything from your old app lives here now, and <b>${sprig}</b> lives here too!</p>
        <p>Your stars, money and jobs all came with you. Nothing got lost.</p>`,
    }, {
      em: '⚡', title: `Help ${sprig} grow`,
      body: `<p>Doing things fills ${sprig}’s <b>energy bar</b> on the home screen: jobs, books, stories, learning and more.</p>
        <p>When the bar is full, ${sprig} goes on an <b>adventure</b> and comes home with a story and <b>acorns 🌰</b>.</p>
        <p>The more adventures, the bigger ${sprig} grows!</p>`,
    }, {
      em: '🛍️', title: 'Spend your acorns',
      body: `<p>Tap the <b>Sprig shop</b> tile to buy hats, colours and furniture with your acorns.</p>
        <p>Tap ${sprig}’s room on the home screen to decorate it.</p>
        <p class="small muted">Acorns are just for fun. They’re not the same as your stars or your money.</p>`,
    }];
    if (has('books')) out.push({
      em: '📚', title: 'Your bookshelf',
      body: `<p>Tap <b>Books</b> to see your shelf. <span style="color:#4caf50">Green</span> = finished, <span style="color:#4a9abf">blue</span> = reading now,
        <span style="color:#e05a4f">red</span> = not read yet.</p>
        <p>Tap a book, then <b>“I’ve started it!”</b> or <b>“I finished it!”</b></p>
        <p>When you finish, do a <b>Book Chat</b>: give it up to 7 stars and tell us what you liked. You can type or <b>tap the 🎤 and talk</b>!</p>
        <p>Your first Book Chat gets ${sprig} a special <b>bookworm cap</b> 🎓</p>`,
    });
    const more = [
      has('chores') && '⭐ <b>Jobs</b>: tick off jobs to earn stars, then swap stars for rewards',
      has('money') && '🐷 <b>Money</b>: your savings jars, and they sit in ' + sprig + '’s room too',
      has('stories') && '🌙 <b>Stories</b>: ask for a brand-new bedtime story',
      has('learn') && '🧠 <b>Learn</b>: find out how things work',
      has('buddy') && '💬 <b>Buddy</b>: have a chat',
    ].filter(Boolean);
    if (more.length) out.push({
      em: '🧭', title: 'Where to find things',
      body: `<p>Everything is on the big tiles on the home screen. The buttons at the bottom are shortcuts.</p>
        <ul class="wn-list">${more.map((m) => `<li>${m}</li>`).join('')}</ul>
        <p>Have fun! 🎉</p>`,
    });
    return out;
  }

  function show(me, pet) {
    const list = pages(me, pet);
    let i = 0;
    sheet('<div id="wn"></div>', (sh, close) => {
      const done = () => { markSeen(me.child.id); close(); };
      const draw = () => {
        const p = list[i], last = i === list.length - 1;
        sh.querySelector('#wn').innerHTML = `<div class="center"><div style="font-size:3.4rem">${p.em}</div><h1>${p.title}</h1></div>
          <div class="wn-body">${p.body}</div>
          <p class="center small muted">${list.map((_, n) => (n === i ? '●' : '○')).join(' ')}</p>
          <div class="row">${i ? '<button class="btn secondary" id="wnBack">Back</button>' : ''}
            <button class="btn block big grow" id="wnNext">${last ? 'Let’s go!' : 'Next'}</button></div>`;
        sh.querySelector('#wnNext').onclick = () => { if (last) done(); else { i += 1; draw(); } };
        const b = sh.querySelector('#wnBack'); if (b) b.onclick = () => { i -= 1; draw(); };
      };
      draw();
    });
  }

  F.kids.whatsNew = {
    /** Called by the kids home after it renders. Never shown to a parent viewing a child's screen. */
    maybeShow(me, pet) { if (me && !me.asParent && me.child && !seen(me.child.id)) show(me, pet); },
    show,
  };
})();
