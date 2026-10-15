/* Kids → Games: three word games that work offline. Finishing a round gives the sprig a little energy.
 * Route: #k/games (the games themselves are pages under /kids-games/) */
(function () {
  const GAMES = [
    ['boggle', '🔤', 'Boggle', 'Find words before time runs out', '#f2b544'],
    ['wordsearch', '🔎', 'Word Search', 'Hunt the hidden words', '#4ec1f0'],
    ['wordconnect', '🧩', 'Word Connect', 'Swipe letters to fill the puzzle', '#a679ff'],
  ];
  F.kids.register({ id: 'games', emoji: '🎮', name: 'Games', colour: '#a679ff', order: 50, render: (el) => {
    el.innerHTML = `<div class="kids">${F.kids.header('Games', '🎮')}<p class="muted">Word games — they work without the internet too.</p>
      <div class="kid-grid">${GAMES.map(([id, em, n, sub, c]) => `<a class="kid-tile" href="/kids-games/${id}.html" style="--c:${c}"><span class="em">${em}</span><b>${F.esc(n)}</b><span class="small">${F.esc(sub)}</span></a>`).join('')}</div></div>`;
  } });
})();
