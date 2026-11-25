// Inventar Rulmenți - stoc comun (Firebase), lucru și fără semnal.
// Păstrează aplicația și biblioteca Firebase în memoria telefonului. Când ai internet,
// descarcă în fundal versiunea nouă a aplicației, care apare la următoarea deschidere.
// Datele stocului nu trec prin acest fișier: le păstrează și le sincronizează Firebase.
const VERSION = '6.0';   // același număr ca APP_VER din index.html; la fiecare actualizare crește cu 1
const CACHE = 'inventar-rulmenti-' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const FB_VER = '13.4.0';
const LIBS = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js']
  .map(f => 'https://www.gstatic.com/firebasejs/' + FB_VER + '/' + f);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));   // straight from the site, not an old copy
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' })
      .then(r => (r && r.ok ? c.put(u, r) : null)).catch(() => null)));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase library: same version forever, so the saved copy is always right
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req.url, res.clone());
      return res;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;   // Firebase servers: never intercepted
  if (url.pathname.endsWith('/sw.js')) return;        // the version check always asks the site
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req)
      .then(res => { if (res && res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    const res = await fresh;
    return res || (await cache.match('./index.html')) || Response.error();
  }));
});
