/*
 * Family → Yoto connection (one per household). A grown-up presses Connect, signs in at Yoto, and comes back here.
 * Needs YOTO_REDIRECT registered in Yoto's developer dashboard, e.g. https://your-family-host/api/family/yoto/callback
 */
const Y = require('../yoto/api');
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  family(r, { pool }) {
    r.get('/yoto/status', a(async (req, res) => res.json({ ok: true, ...(await Y.status()) })));
    r.get('/yoto/connect', (req, res) => {
      if (!Y.configured()) return res.status(503).send('Yoto isn’t set up on this server (YOTO_REDIRECT missing).');
      res.redirect(Y.authorizeUrl());
    });
    r.get('/yoto/callback', async (req, res) => {
      try {
        if (req.query.error) return res.redirect('/?yoto=denied#family');
        await Y.finishLink(String(req.query.state || ''), String(req.query.code || ''), req.uid);
        res.redirect('/?yoto=connected#family');
      } catch (e) { console.warn('[yoto] connect', e.message); res.redirect('/?yoto=failed#family'); }
    });
    r.post('/yoto/disconnect', a(async (req, res) => { await pool.query('DELETE FROM yoto_link WHERE id=1'); res.json({ ok: true }); }));
  },
};
