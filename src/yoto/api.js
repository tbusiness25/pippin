/*
 * Yoto API for Pippin (a child's library and player). Same endpoints the yoto/ pipeline uses, but with Pippin's own
 * login: a public client (PKCE, no secret) whose refresh token rotates on every use, stored encrypted in yoto_link.
 *   YOTO_CLIENT_ID (your Yoto app's public client id; required)   YOTO_REDIRECT (must be registered in Yoto's dashboard)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { pool } = require('../db');
const enc = require('../coach/crypto');

const API = 'https://api.yotoplay.com';
const AUTH = 'https://login.yotoplay.com';
const CLIENT = () => process.env.YOTO_CLIENT_ID || '';
const REDIRECT = () => process.env.YOTO_REDIRECT || '';
const SCOPES = ['user:content:view', 'user:content:manage', 'family:library:view', 'family:library:manage', 'family:devices:view', 'family:devices:control', 'offline_access'];
const pending = new Map();          // state → { verifier, at }   (a few minutes; survives only this process)
let cached = null;                  // { token, exp }
let refreshing = null;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function configured() { return !!REDIRECT(); }

function authorizeUrl() {
  const state = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60000) pending.delete(k);
  pending.set(state, { verifier, at: Date.now() });
  const q = new URLSearchParams({ response_type: 'code', client_id: CLIENT(), redirect_uri: REDIRECT(), audience: API,
    scope: SCOPES.join(' '), state, code_challenge: challenge, code_challenge_method: 'S256' });
  return `${AUTH}/authorize?${q}`;
}

async function tokenPost(body) {
  const r = await fetch(`${AUTH}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body), signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw Object.assign(new Error(d.error_description || d.error || `Yoto sign-in ${r.status}`), { status: 409 });
  return d;
}

/** Callback from Yoto: swap the code for tokens and keep the (single-use) refresh token. */
async function finishLink(state, code, uid) {
  const p = pending.get(state);
  if (!p) throw Object.assign(new Error('That sign-in link expired — start again'), { status: 400 });
  pending.delete(state);
  const d = await tokenPost({ grant_type: 'authorization_code', client_id: CLIENT(), code_verifier: p.verifier, code, redirect_uri: REDIRECT() });
  if (!d.refresh_token) throw Object.assign(new Error('Yoto didn’t give a refresh token — check the app’s offline_access setting'), { status: 502 });
  await saveRefresh(d.refresh_token, uid);
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 - 60000 };
}

async function saveRefresh(rt, uid) {
  await pool.query(`INSERT INTO yoto_link(id, refresh_enc, linked_by, updated_at) VALUES (1,$1,$2,NOW())
    ON CONFLICT (id) DO UPDATE SET refresh_enc=EXCLUDED.refresh_enc, linked_by=EXCLUDED.linked_by, updated_at=NOW()`, [enc.encrypt(rt), uid || null]);
}

async function status() {
  const { rows: [l] } = await pool.query('SELECT linked_by, updated_at FROM yoto_link WHERE id=1');
  return { configured: configured(), linked: !!l, since: l ? l.updated_at : null };
}

/** A valid access token. Refresh tokens rotate: persist the new one before using the new access token. */
async function token() {
  if (cached && Date.now() < cached.exp) return cached.token;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { rows: [l] } = await pool.query('SELECT refresh_enc FROM yoto_link WHERE id=1');
    if (!l) throw Object.assign(new Error('Yoto isn’t connected yet — a grown-up needs to connect it'), { status: 409 });
    const d = await tokenPost({ grant_type: 'refresh_token', client_id: CLIENT(), refresh_token: enc.decrypt(l.refresh_enc) });
    if (d.refresh_token) await saveRefresh(d.refresh_token, null);
    cached = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 - 60000 };
    return cached.token;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function call(method, url, { body, type, raw, timeout = 60000 } = {}) {
  const headers = { Accept: 'application/json', Authorization: `Bearer ${await token()}` };
  if (type) headers['Content-Type'] = type;
  const r = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout) });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Yoto ${method} ${new URL(url).pathname} → ${r.status}: ${text.slice(0, 160)}`), { status: r.status === 401 ? 409 : 502 });
  if (raw) return text;
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

const cards = async () => (await call('GET', `${API}/content/mine`)).cards || [];
const card = async (id) => { const g = await call('GET', `${API}/content/${encodeURIComponent(id)}`); return g.card || g; };
const devices = async () => (await call('GET', `${API}/device-v2/devices/mine`)).devices || [];
const deleteCard = (id) => call('DELETE', `${API}/content/${encodeURIComponent(id)}`);
const saveCard = (payload) => call('POST', `${API}/content`, { body: JSON.stringify(payload), type: 'application/json' });

/** Build a card from ready tracks, one chapter per track (so next/previous works on the player). */
function buildCard(title, tracks, cardId) {
  const chapters = tracks.map((t, i) => ({ key: String(i + 1).padStart(2, '0'), title: t.title, overlayLabel: String(i + 1),
    tracks: [{ key: String(i + 1).padStart(2, '0'), title: t.title, trackUrl: `yoto:#${t.sha}`, type: 'audio', format: t.info.format || 'opus',
      duration: t.info.duration, fileSize: t.info.fileSize, channels: t.info.channels, overlayLabel: String(i + 1) }] }));
  const total = tracks.reduce((a, t) => a + (t.info.duration || 0), 0), size = tracks.reduce((a, t) => a + (t.info.fileSize || 0), 0);
  const p = { title, content: { chapters }, metadata: { media: { duration: total, fileSize: size } } };
  if (cardId) p.cardId = cardId;
  return p;
}

// ---------------------------------------------------------------- audio → track (background)
const sha256 = (file) => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const toMp3 = (src, out) => new Promise((res, rej) => execFile('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '96k', out],
  { timeout: 10 * 60000 }, (err) => (err ? rej(new Error('Couldn’t read that audio file')) : res(out))));

/** Convert, upload and transcode one recording. Updates yoto_jobs as it goes. */
async function makeTrack(jobId, src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yoto-'));
  const set = (f) => pool.query(`UPDATE yoto_jobs SET ${Object.keys(f).map((k, i) => `${k}=$${i + 2}`).join(', ')}, updated_at=NOW() WHERE id=$1`, [jobId, ...Object.values(f)]);
  try {
    const mp3 = await toMp3(src, path.join(dir, 'track.mp3'));
    const digest = await sha256(mp3);
    const size = fs.statSync(mp3).size;
    const start = await call('GET', `${API}/media/transcode/audio/uploadUrl?${new URLSearchParams({ sha256: digest, filename: 'track.mp3' })}`);
    const up = start.upload || {};
    if (!up.uploadId) throw new Error('Yoto didn’t accept the upload');
    await set({ upload_id: up.uploadId, sha: digest });
    if (up.uploadUrl) {                         // null = Yoto already has this exact file
      const r = await fetch(up.uploadUrl, { method: 'PUT', body: fs.readFileSync(mp3), headers: { 'Content-Type': 'audio/mpeg' }, signal: AbortSignal.timeout(600000) });
      if (!r.ok) throw new Error(`Upload failed (${r.status})`);
    }
    const deadline = Date.now() + Math.max(600000, (size / 1e6) * 60000);
    let delay = 2000;
    while (Date.now() < deadline) {
      const got = await call('GET', `${API}/media/upload/${up.uploadId}/transcoded?loudnorm=false`);
      const tr = got.transcode || {};
      if (tr.transcodedSha256) { await set({ status: 'ready', sha: tr.transcodedSha256, info: JSON.stringify(tr.transcodedInfo || {}) }); return; }
      await new Promise((r) => setTimeout(r, delay)); delay = Math.min(delay * 1.4, 10000);
    }
    throw new Error('Yoto is still processing it — try again in a few minutes');
  } catch (e) {
    console.warn('[yoto] track', e.message);
    await set({ status: 'failed', error: String(e.message).slice(0, 300) });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

module.exports = { configured, authorizeUrl, finishLink, status, token, cards, card, devices, deleteCard, saveCard, buildCard, makeTrack, pending };
