const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'finch_session';
const SESSION_DAYS = 30;

if (!JWT_SECRET) {
  console.error('[fatal] JWT_SECRET not set');
  process.exit(1);
}

const signSession = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
}

function setSessionCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: req.secure,            // LAN/Tailscale over http still works; https via proxy stays secure
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

const clearSessionCookie = (res) => res.clearCookie(COOKIE_NAME, { path: '/' });
const hashPin = (pin) => bcrypt.hash(pin, 10);
const verifyPin = (pin, hash) => bcrypt.compare(pin, hash);

function requireAuth(req, res, next) {
  const sess = readSession(req);
  if (!sess || !sess.uid) return res.status(401).json({ ok: false, error: 'unauthorized' });
  req.uid = sess.uid;
  next();
}

module.exports = { signSession, readSession, setSessionCookie, clearSessionCookie, hashPin, verifyPin, requireAuth };
