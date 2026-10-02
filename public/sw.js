// Service worker. Network-first for everything; the shell is cached so the app opens offline.
const CACHE = 'finch-__SW_VERSION__';
const SHELL = ['/', '/css/app.css?v=__SW_VERSION__', '/js/sprig.js?v=__SW_VERSION__', '/js/app.js?v=__SW_VERSION__', '/js/room.js?v=__SW_VERSION__', '/js/sounds.js?v=__SW_VERSION__', '/js/explore.js?v=__SW_VERSION__', '/js/shop.js?v=__SW_VERSION__', '/js/friends.js?v=__SW_VERSION__', '/js/talk.js?v=__SW_VERSION__', '/js/coach.js?v=__SW_VERSION__', '/js/life.js?v=__SW_VERSION__', '/js/habits.js?v=__SW_VERSION__', '/js/sober.js?v=__SW_VERSION__', '/icons/icon.svg', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('/'))));
});

// Nudges. Action buttons log straight from the notification (one-tap logging), falling back to opening the app.
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '__APP_NAME__', {
    body: d.body || '', icon: '/icons/icon.svg', badge: '/icons/icon.svg', tag: d.tag || undefined,
    actions: (d.actions || []).slice(0, 2), data: { url: d.url || '/#home', ...(d.data || {}) } }));
});
const opId = () => (self.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Op-Id': opId() }, body: JSON.stringify(body) });
  if (!r.ok || r.redirected) throw new Error('post failed');
}
function openApp(url) {
  return clients.matchAll({ type: 'window' }).then((ws) => {
    for (const w of ws) { if ('focus' in w) { w.navigate(url); return w.focus(); } }
    return clients.openWindow(url);
  });
}
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  let job = null;
  if (e.action === 'sober-free' && d.tracker) job = post(`/api/sober/${d.tracker}/day`, { day: d.day, status: 'free' });
  if ((e.action === 'habit-done' || e.action === 'habit-mini') && d.habit) job = post(`/api/habits/${d.habit}/log`, { day: d.day, status: e.action === 'habit-done' ? 'done' : 'mini' });
  if (job) {
    e.waitUntil(job.then(() => self.registration.showNotification('__APP_NAME__', { body: 'Logged ✓ 🌱', icon: '/icons/icon.svg', tag: 'logged', silent: true }))
      .catch(() => openApp(d.url || '/#home')));
  } else e.waitUntil(openApp(d.url || '/#home'));
});
