/*
 * Child data rights (parents only): a full export of what is held about one child, a tar of their files,
 * and the purge that permanently removes a child who was removed more than CHILD_PURGE_DAYS ago.
 *
 * Nothing here has a fixed table list. The schema is read from information_schema and pg_constraint on every
 * run, so a new table with a user_id / child_id column, or a foreign key to users, is covered automatically.
 *
 * Which rows belong to a child
 *   owner      a uuid column named user_id or child_id, or any NOT NULL foreign key to users (friendships, kindnesses).
 *              Rows with an owner equal to the child are the child's: exported, and deleted by a purge.
 *   dependant  a table with no owner column whose foreign key points at the child's rows
 *              (adventures.pet_id -> pets). Exported, and deleted by a purge.
 *   reference  a nullable foreign key to users that is not an owner (approved_by, decided_by, reviewed_by,
 *              added_for…). Exported when it names the child. A purge sets it to NULL on rows that stay, so a shared
 *              row (a catalogue book the parent added for them) survives and nothing points at a deleted user.
 *   audit      kid_audit rows whose payload names the child too (a parent's action on the child's things).
 *
 * Secrets: columns named like pin_hash, passwords, tokens, keys, *_enc and similar are never exported. The export
 * header lists which columns were left out, per table.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pool } = require('../db');
const util = require('../kids/util');
const library = require('../kids/library');

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_NAMES = new Set(['user_id', 'child_id']);
const SECRET_COL = /pin_hash|password|passwd|token|secret|credential|cipher|encrypted|(^|_)keys?$|_hash$|(^|_)enc$|_enc$|refresh_(token|enc)|^endpoint$|^auth$|^bearer$|cookie/i;
const MAX_LISTED_FILES = 20000;

/** CHILD_PURGE_DAYS: whole days a removed child's data is kept before the purge. Default 30. */
function purgeDays() {
  const raw = String(process.env.CHILD_PURGE_DAYS ?? '').trim();
  const n = raw === '' ? 30 : Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 30;
}

const q = (name) => `"${String(name).replace(/"/g, '""')}"`;
const assertInside = (base, p) => {
  const root = path.resolve(base) + path.sep;
  if (!path.resolve(p).startsWith(root)) throw new Error('child data: path outside its root');
  return p;
};
const childFolders = (id) => ({
  kids: assertInside(util.DATA, path.join(util.DATA, id)),
  library: assertInside(library.LIB_ROOT, library.userRoot(id)),
});

/**
 * Reads the schema. `query(sql)` returns rows (pool or client). Returns { tables, composite }.
 * tables: Map name -> { cols: Map col -> { type, notnull }, owner: [{col, notnull}], refUser: [{col, notnull}], fks: [{col, ref, notnull}] }
 */
async function discover(query) {
  const cols = await query(`
    SELECT c.table_name, c.column_name, c.data_type, c.is_nullable = 'NO' AS notnull
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN (SELECT t.table_name FROM information_schema.tables t
                             WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE')
     ORDER BY c.table_name, c.ordinal_position`);
  const fks = await query(`
    SELECT cl.relname AS tbl, a.attname AS col, a.attnotnull AS notnull, rc.relname AS ref,
           c.conname AS name, array_length(c.conkey, 1) AS width
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_class rc ON rc.oid = c.confrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND ns.nspname = 'public'`);

  const tables = new Map();
  for (const r of cols) {
    if (!tables.has(r.table_name)) tables.set(r.table_name, { cols: new Map(), owner: [], refUser: [], fks: [] });
    tables.get(r.table_name).cols.set(r.column_name, { type: r.data_type, notnull: r.notnull });
  }
  const composite = [];
  const fkCols = new Set();
  for (const f of fks) {
    if (f.width > 1) { composite.push(f); continue; }
    fkCols.add(`${f.tbl}.${f.col}`);
    const t = tables.get(f.tbl);
    if (!t) continue;
    if (f.ref === 'users') {
      (OWNER_NAMES.has(f.col) || f.notnull ? t.owner : t.refUser).push({ col: f.col, notnull: f.notnull });
    } else {
      t.fks.push({ col: f.col, ref: f.ref, notnull: f.notnull });
    }
  }
  // user_id / child_id uuid columns with no foreign key are owners too.
  for (const [name, t] of tables) {
    for (const [col, meta] of t.cols) {
      if (OWNER_NAMES.has(col) && meta.type === 'uuid' && !fkCols.has(`${name}.${col}`) && !t.owner.some((o) => o.col === col)) {
        t.owner.push({ col, notnull: meta.notnull });
      }
    }
  }
  return { tables, composite };
}

/** Predicate (SQL over the table's own columns, $1 = the child id) that selects the child's rows, or null. */
function predicates(model) {
  const memo = new Map(), busy = new Set();
  const pred = (name) => {
    if (name === 'users') return null;
    if (memo.has(name)) return memo.get(name);
    if (busy.has(name)) throw new Error(`child data: foreign-key cycle through ${name}`);
    busy.add(name);
    const t = model.tables.get(name);
    const parts = t.owner.map((o) => `${q(o.col)} = $1::uuid`);
    if (name === 'kid_audit' && t.cols.has('payload')) parts.push(`${q('payload')}::text LIKE '%' || ($1::uuid)::text || '%'`);
    if (!t.owner.length) {
      for (const f of t.fks) {
        const p = pred(f.ref);
        if (p) parts.push(`${q(f.col)} IN (SELECT ${q('id')} FROM ${q(f.ref)} WHERE ${p})`);
      }
    }
    busy.delete(name);
    const out = parts.length ? parts.map((p) => `(${p})`).join(' OR ') : null;
    memo.set(name, out);
    return out;
  };
  return pred;
}

/** Export predicate: the child's rows, plus rows where a reference column names the child. */
function exportPred(model, pred, name) {
  const parts = [];
  const own = pred(name);
  if (own) parts.push(own);
  for (const r of model.tables.get(name).refUser) parts.push(`${q(r.col)} = $1::uuid`);
  return parts.length ? parts.map((p) => `(${p})`).join(' OR ') : null;
}

/** What a purge does, in order: clear references on rows that stay, delete the child's rows (referencing tables first). */
function purgePlan(model, pred) {
  const doomed = [...model.tables.keys()].filter((n) => n !== 'users' && pred(n));
  const doomedSet = new Set(doomed);
  for (const f of model.composite) {
    if (f.ref === 'users' || doomedSet.has(f.ref) || doomedSet.has(f.tbl)) {
      throw new Error(`composite foreign key ${f.name} is not supported by the child purge`);
    }
  }

  const clears = [];
  for (const [name, t] of model.tables) {
    if (name === 'users') continue;
    const targets = [
      ...t.refUser.map((r) => ({ col: r.col, notnull: r.notnull, match: `${q(r.col)} = $1::uuid` })),
      ...t.fks.filter((f) => doomedSet.has(f.ref)).map((f) => ({ col: f.col, notnull: f.notnull,
        match: `${q(f.col)} IN (SELECT ${q('id')} FROM ${q(f.ref)} WHERE ${pred(f.ref)})` })),
    ];
    const keep = `NOT (${pred(name) || 'FALSE'})`;
    for (const m of targets) clears.push({ table: name, col: m.col, notnull: m.notnull, where: `${m.match} AND ${keep}` });
  }

  // Delete order: a table that references another doomed table goes first.
  const refs = new Map(doomed.map((n) => [n, new Set()]));
  for (const n of doomed) {
    for (const f of model.tables.get(n).fks) if (doomedSet.has(f.ref) && f.ref !== n) refs.get(n).add(f.ref);
  }
  const pending = new Map(doomed.map((n) => [n, 0]));
  for (const n of doomed) for (const r of refs.get(n)) pending.set(r, pending.get(r) + 1);
  const ready = doomed.filter((n) => pending.get(n) === 0), order = [];
  while (ready.length) {
    const n = ready.shift();
    order.push(n);
    for (const r of refs.get(n)) { pending.set(r, pending.get(r) - 1); if (pending.get(r) === 0) ready.push(r); }
  }
  if (order.length !== doomed.length) throw new Error('child purge: foreign-key cycle between child tables');
  return { doomed, order, clears };
}

const plain = (v) => (Buffer.isBuffer(v) ? v.toString('base64') : v);
function withoutSecrets(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) if (!SECRET_COL.test(k)) out[k] = plain(v);
  return out;
}

/** Files on disk for a child: relative path, size, modified time. Symlinks are not followed. */
async function listFiles(id) {
  const folders = childFolders(id);
  const out = [];
  let truncated = false;
  for (const [root, dir] of Object.entries(folders)) {
    const stack = [['', dir]];
    while (stack.length) {
      const [rel, abs] = stack.pop();
      let entries;
      try { entries = await fs.promises.readdir(abs, { withFileTypes: true }); } catch (_) { continue; }
      for (const e of entries) {
        const p = path.join(abs, e.name), r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) { stack.push([r, p]); continue; }
        if (!e.isFile()) continue;
        if (out.length >= MAX_LISTED_FILES) { truncated = true; break; }
        const st = await fs.promises.lstat(p).catch(() => null);
        if (st) out.push({ root, path: r, bytes: st.size, modified: st.mtime.toISOString() });
      }
      if (truncated) break;
    }
  }
  return { files: out, truncated };
}

/** The JSON export for one child (their row, and every row that belongs to them or names them). */
async function exportChild(kid) {
  const model = await discover((s) => pool.query(s).then((r) => r.rows));
  const pred = predicates(model);
  const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [kid.id]);
  if (!user) throw new Error('child not found');

  const tables = {}, counts = {}, redacted = {};
  const pushTable = (name, rows) => {
    tables[name] = rows.map(withoutSecrets);
    counts[name] = rows.length;
    const sc = [...model.tables.get(name).cols.keys()].filter((c) => SECRET_COL.test(c));
    if (sc.length) redacted[name] = sc;
  };
  pushTable('users', [user]);
  for (const name of model.tables.keys()) {
    if (name === 'users') continue;
    const p = exportPred(model, pred, name);
    if (!p) continue;
    const { rows } = await pool.query(`SELECT * FROM ${q(name)} WHERE ${p}`, [kid.id]);
    if (rows.length) pushTable(name, rows);
  }
  const { files, truncated } = await listFiles(kid.id);
  const removed = user.settings?.kids?.removed_at || null;
  return {
    format: 'pippin-child-export',
    version: 1,
    generated_at: new Date().toISOString(),
    child: { id: user.id, name: user.name, created_at: user.created_at, deleted_at: user.deleted_at, removed_at: removed },
    notes: [
      'Passwords, PIN codes, tokens, keys and other secrets are not in this file. "redacted" lists the columns left out, per table.',
      'Files kept on disk are listed under "files". Download them as .tar archives from the same place as this file.',
      'Copies held outside this server (for example a notes vault, or a service such as Yoto) are not included.',
    ],
    redacted,
    counts,
    files,
    files_truncated: truncated,
    tables,
  };
}

/** Streams a tar of one child's folder (kids' files, or their library) with the system tar. Responds 501 if tar is missing. */
function streamTar(res, { root, id }) {
  if (!UUID_RE.test(id)) throw new Error('child data: bad id');
  const folders = childFolders(id);
  const dir = folders[root];
  const base = root === 'library' ? library.LIB_ROOT : util.DATA;
  // `-C base id` keeps the child's id as the top folder inside the archive. No user-supplied path reaches tar.
  const args = fs.existsSync(dir)
    ? ['-c', '-f', '-', '-C', base, id]
    : ['-c', '-f', '-', '--files-from=/dev/null'];   // nothing stored yet: an empty, valid archive
  const child = spawn('tar', args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: '/' });
  let started = false, stderr = '';
  child.stderr.on('data', (d) => { if (stderr.length < 2000) stderr += d; });
  child.once('spawn', () => {
    started = true;
    res.set({
      'Content-Type': 'application/x-tar',
      'Content-Disposition': `attachment; filename="pippin-${root}-${id}.tar"`,
      'Cache-Control': 'no-store',
    });
    child.stdout.pipe(res);
  });
  child.once('error', (e) => {
    if (started) { res.destroy(); return; }
    if (res.headersSent) return;
    if (e.code === 'ENOENT') {
      return res.status(501).json({ ok: false, error: 'The tar program is not installed on this server, so the files cannot be packed. The JSON export still includes every record.' });
    }
    res.status(500).json({ ok: false, error: 'Could not pack the files' });
  });
  child.on('close', (code) => {
    if (started && code > 1) { console.error(`[child-export] tar exited with ${code}`); res.destroy(); }
    else if (code > 1 && stderr) console.error(`[child-export] tar: ${stderr.split('\n')[0].slice(0, 200)}`);
  });
  res.on('close', () => { if (child.exitCode === null) child.kill('SIGTERM'); });
}

/** Counts (dry run) or deletes (real run) one removed child, in one transaction. */
async function purgeChild(id, { dry = false } = {}) {
  if (!UUID_RE.test(id)) throw new Error('child purge: bad id');
  const days = purgeDays();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [kid] } = await client.query(
      `SELECT id FROM users WHERE id=$1 AND role='child' AND deleted_at IS NOT NULL
          AND deleted_at < NOW() - make_interval(days => $2) FOR UPDATE`, [id, days]);
    if (!kid) { await client.query('ROLLBACK'); return null; }

    const model = await discover((s) => client.query(s).then((r) => r.rows));
    const pred = predicates(model);
    const plan = purgePlan(model, pred);
    let cleared = 0, deleted = 0;
    const tablesHit = new Set();

    for (const c of plan.clears) {
      const { rows: [{ n }] } = await client.query(`SELECT COUNT(*)::int AS n FROM ${q(c.table)} WHERE ${c.where}`, [id]);
      if (!n) continue;
      if (c.notnull) throw new Error(`child purge: ${c.table}.${c.col} must keep pointing at a row that stays`);
      if (!dry) await client.query(`UPDATE ${q(c.table)} SET ${q(c.col)} = NULL WHERE ${c.where}`, [id]);
      cleared += n; tablesHit.add(c.table);
    }
    for (const name of plan.order) {
      if (dry) {
        const { rows: [{ n }] } = await client.query(`SELECT COUNT(*)::int AS n FROM ${q(name)} WHERE ${pred(name)}`, [id]);
        deleted += n; if (n) tablesHit.add(name);
      } else {
        const r = await client.query(`DELETE FROM ${q(name)} WHERE ${pred(name)}`, [id]);
        deleted += r.rowCount; if (r.rowCount) tablesHit.add(name);
      }
    }
    if (!dry) {
      const r = await client.query(`DELETE FROM users WHERE id=$1 AND role='child' AND deleted_at IS NOT NULL`, [id]);
      if (r.rowCount !== 1) throw new Error('child purge: the child row changed during the purge');
    }

    const folders = Object.values(childFolders(id)).filter((d) => fs.existsSync(d));
    if (dry) {
      await client.query('ROLLBACK');
      console.log(`[child-purge] dry run: child ${id} would lose ${deleted} rows in ${tablesHit.size} tables (${cleared} references cleared), ${folders.length} file folder(s)`);
    } else {
      // Files go before the commit: if removing them fails, the transaction rolls back and the next run retries.
      for (const d of folders) fs.rmSync(d, { recursive: true, force: true });
      await client.query('COMMIT');
      console.log(`[child-purge] purged child ${id}: ${deleted} rows in ${tablesHit.size} tables (${cleared} references cleared), ${folders.length} file folder(s) removed`);
    }
    return { rows: deleted, tables: tablesHit.size, cleared, folders: folders.length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Purges every removed child older than CHILD_PURGE_DAYS. Children only: adults are never selected. */
async function purgeDue({ dry = process.env.CHILD_PURGE_DRY_RUN === 'true' } = {}) {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE role='child' AND deleted_at IS NOT NULL
        AND deleted_at < NOW() - make_interval(days => $1) ORDER BY deleted_at`, [purgeDays()]);
  let done = 0;
  for (const { id } of rows) {
    try { if (await purgeChild(id, { dry })) done++; }
    catch (e) { console.error(`[child-purge] child ${id} not purged: ${e.message}`); }
  }
  return done;
}

/** Once a day, ten minutes after start. Overlapping runs are skipped. */
function startPurge() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await purgeDue(); }
    catch (e) { console.error('[child-purge] run failed:', e.message); }
    finally { running = false; }
  };
  const first = setTimeout(() => { run(); setInterval(run, DAY_MS).unref(); }, 10 * 60 * 1000);
  first.unref();
}

module.exports = { purgeDays, discover, predicates, purgePlan, exportChild, streamTar, purgeChild, purgeDue, startPurge, UUID_RE, SECRET_COL };
