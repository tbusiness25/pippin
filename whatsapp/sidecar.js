/*
 * pippin-whatsapp — a WhatsApp linked device that records contact METADATA for Pippin's "your people":
 *   which 1:1 chat, when, and whether the message was sent or received (plus the contact's display name).
 * It NEVER reads, logs or forwards message text, media, or group chats. Events are batched to Pippin's
 * internal endpoint every minute. Linking: Pippin → Friends → Your people → "Link WhatsApp" shows the QR.
 * Session lives in /data (volume). Unlink any time from the app or WhatsApp → Linked devices.
 */
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import http from 'http';
import fs from 'fs';

const APP_URL = process.env.APP_INTERNAL_URL || process.env.FINCH_INTERNAL_URL || 'http://app:8080/internal';
const SECRET = process.env.WHATSAPP_SIDECAR_SECRET;
const DATA = '/data';
const OWNER_FILE = `${DATA}/owner`;
let owner = fs.existsSync(OWNER_FILE) ? fs.readFileSync(OWNER_FILE, 'utf8').trim() : null;
let state = 'idle', qr = null, sock = null, queue = [];

const handleOf = (jid) => (jid || '').split('@')[0].split(':')[0];
const isPerson = (jid) => /@(s\.whatsapp\.net|lid)$/.test(jid || '');

async function start() {
  if (sock) return;
  state = 'connecting';
  const { state: auth, saveCreds } = await useMultiFileAuthState(`${DATA}/session`);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  sock = makeWASocket({ auth, version, logger: pino({ level: 'silent' }), printQRInTerminal: false,
    browser: [process.env.APP_NAME || 'Pippin', 'Chrome', '1.0'], markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    if (u.qr) { qr = await QRCode.toDataURL(u.qr); state = 'waiting-for-scan'; }
    if (u.connection === 'open') { state = 'linked'; qr = null; console.log('[pippin-whatsapp] linked'); }
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      sock = null;
      if (code === DisconnectReason.loggedOut) { state = 'logged-out'; fs.rmSync(`${DATA}/session`, { recursive: true, force: true }); console.log('[pippin-whatsapp] logged out'); }
      else { state = 'reconnecting'; setTimeout(start, 5000); }
    }
  });
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const m of messages) {
      // Prefer the phone-number JID when WhatsApp gives a LID, so history imports and live events match.
      const jid = jidNormalizedUser(m.key.remoteJidAlt || m.key.remoteJid || '');
      if (!isPerson(jid) || !m.messageTimestamp) continue;          // 1:1 chats only: no groups, status or broadcasts
      queue.push({ handle: handleOf(jid), display: m.key.fromMe ? undefined : (m.pushName || undefined),
        fromMe: !!m.key.fromMe, ts: Number(m.messageTimestamp) * 1000 });
      // m.message (the content) is deliberately never touched.
    }
  });
}

async function flush() {
  if (!queue.length || !owner) return;
  const batch = queue.splice(0, 500);
  try {
    const r = await fetch(`${APP_URL}/contact-events`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, owner, events: batch }) });
    if (!r.ok) throw new Error(`app ${r.status}`);
  } catch (e) { queue.unshift(...batch); console.warn('[pippin-whatsapp] flush failed:', e.message); }
}
setInterval(flush, 60000);

// Tiny control API, reachable only on the private Docker network (no published port).
http.createServer(async (req, res) => {
  const json = (code, b) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
  if (req.url === '/status') return json(200, { state, qr, linkedTo: owner ? 'set' : null, queued: queue.length });
  if (req.method === 'POST' && req.url === '/start') {
    const who = req.headers['x-app-owner'];
    if (owner && who !== owner) return json(403, { error: 'linked to another Pippin user' });
    if (/^[0-9a-f-]{36}$/.test(who || '')) { owner = who; fs.writeFileSync(OWNER_FILE, who); }
    start().catch((e) => { state = 'error'; console.error(e.message); });
    return json(200, { ok: true });
  }
  if (req.method === 'POST' && req.url === '/logout') {
    try { await sock?.logout(); } catch (_) {}
    sock = null; state = 'logged-out'; qr = null;
    fs.rmSync(`${DATA}/session`, { recursive: true, force: true });
    return json(200, { ok: true });
  }
  json(404, {});
}).listen(3000, () => {
  console.log('[pippin-whatsapp] control on :3000');
  if (fs.existsSync(`${DATA}/session/creds.json`)) start();
});
