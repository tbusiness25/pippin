/*
 * Network guard for the children's model (KIDS_LLM_URL, or STORY_BASE_URL as a fallback).
 *
 * By default that model may only call a host on the family's own network:
 *   localhost and loopback, private IPv4 (10/8, 172.16/12, 192.168/16), link-local (169.254/16),
 *   CGNAT (100.64/10, Tailscale), single-label names (docker service names such as `ollama`),
 *   and names ending in .local, .lan, .home.arpa, .internal or .ts.net.
 * Everything else is refused before any request is made, so nothing is sent.
 * KIDS_LLM_ALLOW_CLOUD=true turns the block off; a warning is logged once at startup.
 *
 * Dependency-free on purpose, so scripts/check-kids-llm-guard.js can run without the app's packages.
 */

const BLOCKED_MESSAGE = 'The children’s model only runs on your own network. Set KIDS_LLM_ALLOW_CLOUD=true to allow a cloud model (not recommended).';
const LOCAL_SUFFIXES = ['.local', '.lan', '.home.arpa', '.internal', '.ts.net'];
const ALLOW_CLOUD = String(process.env.KIDS_LLM_ALLOW_CLOUD || '').trim().toLowerCase() === 'true';

if (ALLOW_CLOUD) {
  console.warn('[kids-llm] KIDS_LLM_ALLOW_CLOUD=true: the children’s model may call a cloud endpoint. This is not recommended.');
}

// `hostname` as the WHATWG URL parser reports it, e.g. "[::1]", "192.168.1.5", "ollama".
function isLocalHost(hostname) {
  let h = String(hostname || '').trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (!h) return false;
  if (h === 'localhost' || h === '::1') return true;
  const mapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);   // IPv4-mapped IPv6
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
    h = [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
  }
  if (h.includes(':')) return false;   // other IPv6 literals are not on the list
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return false;
    const [a, b] = octets;
    return a === 127                              // loopback 127/8
      || a === 10                                 // 10/8
      || (a === 172 && b >= 16 && b <= 31)        // 172.16/12
      || (a === 192 && b === 168)                 // 192.168/16
      || (a === 169 && b === 254)                 // link-local 169.254/16
      || (a === 100 && b >= 64 && b <= 127);      // CGNAT 100.64/10 (Tailscale)
  }
  if (!h.includes('.')) return true;              // single label: a compose service name or LAN short name
  return LOCAL_SUFFIXES.some((s) => h.endsWith(s));
}

// True when a request to `url` may be sent. `allowCloud` defaults to the KIDS_LLM_ALLOW_CLOUD setting.
function kidsLlmUrlAllowed(url, allowCloud = ALLOW_CLOUD) {
  if (allowCloud) return true;
  let hostname;
  try { hostname = new URL(String(url)).hostname; } catch { return false; }
  return isLocalHost(hostname);
}

// Throws before anything is sent when `url` is not on the family's network.
function assertKidsLlmUrl(url, allowCloud = ALLOW_CLOUD) {
  if (!kidsLlmUrlAllowed(url, allowCloud)) throw new Error(BLOCKED_MESSAGE);
}

module.exports = { BLOCKED_MESSAGE, ALLOW_CLOUD, isLocalHost, kidsLlmUrlAllowed, assertKidsLlmUrl };
