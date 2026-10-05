/*
 * Client for the optional fitness backend (SparkyFitness, run headless next to Pippin).
 * Each Pippin person gets their own backend account, created on first use; Pippin keeps only an API key,
 * encrypted. The backend is reachable only from Pippin's private Docker network, so nothing is exposed.
 * Only the calls Pippin needs are exposed through routes/fitness.js — never a generic proxy.
 */
const crypto = require('crypto');
const { pool } = require('../db');
const { encrypt, decrypt } = require('../coach/crypto');

const BASE = (process.env.SPARKY_URL || '').replace(/\/$/, '');
const ORIGIN = 'http://app:8080';     // must match SPARKY_FITNESS_FRONTEND_URL in docker-compose.yml
const available = () => !!BASE;
const keys = new Map();               // user id → key (in memory, so we decrypt once)

async function raw(method, path, { key, token, body, timeout = 30000 } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: ORIGIN };
  if (key || token) headers.Authorization = `Bearer ${key || token}`;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
    const e = new Error(typeof msg === 'string' ? msg.slice(0, 200) : `fitness backend error ${r.status}`); e.status = r.status; throw e;
  }
  return data;
}

// Create this person's backend account and an API key (first use only).
async function provision(uid) {
  const email = `${uid}@pippin.local`;
  const password = crypto.randomBytes(24).toString('base64url');
  const su = await raw('POST', '/api/auth/sign-up/email', { body: { email, password, name: 'Pippin user' } });
  const token = su?.token || (await raw('POST', '/api/auth/sign-in/email', { body: { email, password } }))?.token;
  const r = await raw('POST', '/api/identity/user/generate-api-key', { token, body: { name: 'pippin', expiresIn: null } });
  const key = r?.apiKey?.key;
  if (!key) throw new Error('could not create a fitness account');
  await pool.query('INSERT INTO fitness_links(user_id, backend_email, key_enc) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO NOTHING', [uid, email, encrypt(key)]);
  return key;
}

async function keyFor(uid) {
  if (keys.has(uid)) return keys.get(uid);
  const { rows } = await pool.query('SELECT key_enc FROM fitness_links WHERE user_id=$1', [uid]);
  const key = rows.length ? decrypt(rows[0].key_enc) : await provision(uid);
  keys.set(uid, key);
  return key;
}

const call = async (uid, method, path, body, opts = {}) => raw(method, path, { key: await keyFor(uid), body, ...opts });

module.exports = { available, call, keyFor };
