/* 🌾 The village for children — the same scene as grown-ups', on the children's own API (time rules apply). */
(function () {
  F.kids.register({ id: 'village', emoji: '🌾', name: 'Village', colour: '#7bb661', order: 50,
    render(el) { F.village.open(el, { base: '/api/kids/village', mode: 'self' }); } });
})();
