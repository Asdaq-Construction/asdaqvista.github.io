/* Asdaq Vista — makes the site installable and quick to open.
   Only the website files are cached; bills always come live from the server. */
const CACHE = 'asdaq-vista-v4';
const SHELL = ['./', 'index.html', 'assets/css/style.css', 'assets/js/config.js', 'assets/js/demo.js', 'assets/js/api.js', 'assets/js/app.js',
  'assets/img/logo-wordmark.png', 'assets/img/badge-asdaq-constructions.png', 'assets/img/building.jpg', 'assets/img/blueprint.svg',
  'assets/img/elevation-lines.svg', 'assets/img/app-icon-192.png', 'assets/img/app-icon-512.png', 'assets/img/icon-180.png', 'assets/img/icon-32.png', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;   // never touch bill data
  // newest files first; fall back to the saved copy when offline
  e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
    .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
});
