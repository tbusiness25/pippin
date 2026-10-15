/* 🌾 The village for grown-ups: an Explore tile, the page, and (in Family) the public villages of the rest of the household. */
(function () {
  const esc = F.esc;
  F.routes.village = () => F.village.open(document.getElementById('app'), { base: '/api/village', mode: 'self' });
  if (F.explore && F.explore.tile) F.explore.tile({ href: '#village', emoji: '🌾', name: 'Village', sub: 'Sprig town & the bus' });
})();
