/* Tell the app a round was finished so the child's sprig gets a little energy. Silent if offline or not a child. */
(function () {
  function toast(text) {
    var t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#2f6b3a;color:#fff;padding:12px 18px;' +
      'border-radius:999px;font:700 16px system-ui,sans-serif;z-index:99;box-shadow:0 4px 16px #0006;max-width:90vw;text-align:center';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }
  window.kidsRound = function (game) {
    var round = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    fetch('/api/kids/games/finished', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: game, round: round }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var m = d && d.sprig && d.sprig.messages;
        if (m && m.length) m.forEach(function (x, i) { setTimeout(function () { toast(x); }, i * 1500); });
      })
      .catch(function () {});
  };
})();
