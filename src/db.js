const { Pool, types } = require('pg');

// DATE columns stay 'YYYY-MM-DD' strings — a JS Date would shift the day across timezones.
types.setTypeParser(1082, (v) => v);
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 8,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => console.error('[pg pool error]', err.message));

async function waitForDb(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (e) {
      console.log(`[db] wait ${i + 1}/${maxAttempts}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('database did not become available');
}

async function runMigrations() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  for (const f of files) {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (rows.length) continue;
    console.log(`[db] applying migration ${f}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

async function initDb() {
  await waitForDb();
  await runMigrations();
}

module.exports = { pool, initDb };
