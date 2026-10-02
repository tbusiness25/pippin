/*
 * At-rest encryption for the coach's sensitive text (chat, intake profile).
 * AES-256-GCM, key = DATA_KEY (64 hex chars). Format: v1:<iv hex>:<tag hex>:<ciphertext hex>.
 * Lose the key and the coach's history is unreadable — that is the point. Back it up with .env.
 */
const crypto = require('crypto');

let KEY = null;
function key() {
  if (KEY) return KEY;
  const hex = (process.env.DATA_KEY || process.env.FINCH_DATA_KEY) || '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('DATA_KEY must be 64 hex characters (openssl rand -hex 32)');
  KEY = Buffer.from(hex, 'hex');
  return KEY;
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1:${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
}

function decrypt(blob) {
  const [v, iv, tag, ct] = String(blob).split(':');
  if (v !== 'v1') throw new Error('unknown ciphertext version');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(ct, 'hex')), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, check: () => key() && true };
