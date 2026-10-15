/*
 * Word games (Boggle, Word Search, Word Connect) are static offline pages in public/kids-games/.
 * When a child finishes a round the page calls POST /api/kids/games/finished { game, round } and the sprig
 * gets a little energy (once per round id; the sprig's daily cap keeps it gentle).
 */
const GAMES = ['boggle', 'wordsearch', 'wordconnect'];

module.exports = {
  routes(r, { sprig }) {
    r.get('/games', (req, res) => res.json({ ok: true, games: GAMES }));
    r.post('/games/finished', async (req, res) => {
      const { game, round } = req.body || {};
      if (!GAMES.includes(game) || !/^[\w-]{6,64}$/.test(String(round || ''))) return res.status(400).json({ ok: false, error: 'bad_round' });
      if (req.asParent) return res.json({ ok: true });
      res.json({ ok: true, sprig: await sprig.reward(req.kid.id, 'game', `${game}:${round}`) });
    });
  },
};
