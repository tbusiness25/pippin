/* Demo banner (DEMO_MODE servers only): it's a shared made-up family, it resets nightly, and you can view as anyone. */
(function () {
  if (!(window.__BUILD__ && window.__BUILD__.demo)) return;
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Demo');
  document.body.prepend(bar);
  async function draw() {
    let d; try { d = await (await fetch('/api/demo', { credentials: 'same-origin' })).json(); } catch { return; }
    if (!d || !d.ok) return;
    if (d.guest) {
      bar.innerHTML = '<span>🧪 <b>Demo</b> — put in your own home and work postcodes. Your route is private to this browser and is wiped every night.</span>';
      if (!location.hash || location.hash === '#home') location.hash = d.landing || '#home';
      return;
    }
    bar.innerHTML = `<span>🧪 <b>Demo</b> — a made-up family, shared by everyone who visits. Don’t type anything private. Resets nightly.</span>
      <span class="demo-who">View as ${d.people.map((p) => `<button class="${p.slug === d.me ? 'on' : ''}" data-as="${p.slug}">${p.name}${p.role === 'child' ? ' (child)' : ''}</button>`).join('')}</span>`;
    bar.querySelectorAll('[data-as]').forEach((b) => { b.onclick = async () => {
      await fetch(`/api/demo/as/${b.dataset.as}`, { method: 'POST', credentials: 'same-origin' });
      location.hash = '#home'; location.reload();
    }; });
  }
  draw();
})();
