/* Family → child → "Their room": the same switches the child has (noise, night light, sleep timer). */
(function () {
  F.family.childPanel({ id: 'room', module: 'room', emoji: '🛏️', name: 'Their room', sub: 'Noise, light, sleep timer', order: 44,
    async render(el, child) {
      el.innerHTML = `<h1>🛏️ ${F.esc(child.name)}’s room</h1><div id="rm" class="kids"></div>`;
      if (!F.kroom) { el.querySelector('#rm').textContent = 'Not available.'; return; }
      await F.kroom.draw(el.querySelector('#rm'), (p, o) => F.family.kapi(child, p, o), { title: false });
    } });
})();
