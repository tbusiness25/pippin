/*
 * PIN guessing protection. A 4-digit PIN is only safe if guesses are scarce, so failed attempts are counted
 * per client IP and per account; after 5 misses that key is locked out, doubling each time (1 min → 2 h cap).
 * In memory: a restart clears it, which is acceptable for a single-instance self-hosted app.
 */
const FREE = 5;
const BASE_MS = 60 * 1000;
const MAX_MS = 2 * 60 * 60 * 1000;
const fails = new Map();   // key → { n, until }

function lockedFor(keys) {
  const now = Date.now();
  return Math.max(0, ...keys.map((k) => ((fails.get(k)?.until || 0) - now)));
}
function fail(keys) {
  for (const k of keys) {
    const f = fails.get(k) || { n: 0, until: 0 };
    f.n += 1;
    if (f.n >= FREE) f.until = Date.now() + Math.min(MAX_MS, BASE_MS * 2 ** (f.n - FREE));
    fails.set(k, f);
  }
}
const ok = (keys) => keys.forEach((k) => fails.delete(k));

// Forget stale entries so the map can't grow forever.
setInterval(() => {
  const cutoff = Date.now() - MAX_MS;
  for (const [k, f] of fails) if (f.until < cutoff) fails.delete(k);
}, 10 * 60 * 1000).unref();

module.exports = { lockedFor, fail, ok };
