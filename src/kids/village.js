/* 🌾 The village for children — the same router as /api/village, mounted under the kids API so the time-of-day rules apply (see access.js).
 * The kids router sees paths without /api/kids, so the village routes live at /village/... */
module.exports = {
  routes(r) { r.use('/village', require('../routes/village')); },
};
