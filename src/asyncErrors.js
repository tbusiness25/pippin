/*
 * Express 4 doesn't catch errors thrown by async route handlers: a rejected promise becomes an unhandled
 * rejection and (on Node ≥15) kills the whole server. This makes every handler's rejection go to next(err),
 * i.e. the normal 500 handler, the way Express 5 does. Required once, before any routes are created.
 */
const Layer = require('express/lib/router/layer');

const original = Layer.prototype.handle_request;
Layer.prototype.handle_request = function handle(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return original.call(this, req, res, next);   // error handlers: unchanged
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch((e) => next(e || new Error('handler rejected')));
  } catch (e) { next(e); }
};

// Last line of defence for background jobs: log, don't die.
process.on('unhandledRejection', (e) => console.error('[unhandled]', e && (e.stack || e.message || e)));
