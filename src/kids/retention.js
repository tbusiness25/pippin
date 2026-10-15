/*
 * Retention for children's stored data (Buddy chat, Book Chat voice notes).
 *
 *   daysFromEnv(name, dflt)   — parses a days setting. 0 = keep forever. Anything that is not a whole number >= 0
 *                               falls back to the default (and says so once in the log).
 *   purgeOld(pool, opts)      — hard-deletes one table's rows older than `days`, for CHILD accounts only
 *                               (users.role = 'child'), and removes the audio files of those rows when
 *                               `audioPaths(row)` is given. Returns counts and the deleted rows. Never logs content.
 *   scheduleDaily(label, fn)  — runs fn ten minutes after start, then every 24 hours. Failures are logged as one line.
 *
 * Nothing here runs unless a days value is above 0, so the default for Book Chat (0) keeps everything.
 */
const fs = require('fs');

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_MS = 10 * 60 * 1000;
const IDENT = /^[a-z_][a-z0-9_]*$/;

function daysFromEnv(name, dflt) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') return dflt;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    console.warn(`[retention] ${name} is not a whole number of days; using ${dflt}`);
    return dflt;
  }
  return n;
}

/**
 * Delete rows of `table` whose `tsColumn` is older than `days`, where `childColumn` belongs to a child account.
 * Generated SQL (for table kid_chat_messages, created_at, child_id, days = 90):
 *   DELETE FROM kid_chat_messages
 *    WHERE child_id IN (SELECT id FROM users WHERE role = 'child')
 *      AND created_at < NOW() - make_interval(days => $1)
 *      AND NOT (flagged AND reviewed_at IS NULL)     -- only when keepWhere is set (Buddy)
 *    RETURNING *
 * When `audioPaths` is set, each returned row's files are unlinked afterwards (a missing file is not an error).
 */
async function purgeOld(pool, { table, tsColumn, childColumn, days, audioPaths = null, keepWhere = null }) {
  for (const id of [table, tsColumn, childColumn]) {
    if (!IDENT.test(id)) throw new Error(`retention: bad identifier ${id}`);
  }
  if (!(days > 0)) return { deleted: 0, audioRemoved: 0, audioFailed: 0, rows: [] };

  // keepWhere is a fixed SQL condition written in the calling module (never user input): rows matching it survive.
  const keep = keepWhere ? `AND NOT (${keepWhere})` : '';
  const { rows } = await pool.query(
    `DELETE FROM ${table}
      WHERE ${childColumn} IN (SELECT id FROM users WHERE role = 'child')
        AND ${tsColumn} < NOW() - make_interval(days => $1)
        ${keep}
      RETURNING *`, [days]);

  let audioRemoved = 0, audioFailed = 0;
  if (audioPaths) {
    for (const row of rows) {
      for (const p of audioPaths(row)) {
        try { await fs.promises.unlink(p); audioRemoved += 1; }
        catch (e) { if (e.code !== 'ENOENT') audioFailed += 1; }
      }
    }
  }
  return { deleted: rows.length, audioRemoved, audioFailed, rows };
}

function scheduleDaily(label, job) {
  const run = () => Promise.resolve().then(job).catch((e) => console.warn(`[retention] ${label} failed: ${e.message}`));
  const first = setTimeout(() => { run(); setInterval(run, DAY_MS).unref(); }, FIRST_RUN_MS);
  first.unref();
}

module.exports = { daysFromEnv, purgeOld, scheduleDaily };
