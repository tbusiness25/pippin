/* 🌾 The village for children — the same router as /api/village, so the time-of-day rules apply (see access.js). */
module.exports = {
  routes(r) { r.use(require('../routes/village')); },
};
