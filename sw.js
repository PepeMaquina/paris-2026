const V = 'paris-2026-08-27-11';
const NUCLEO = [
  './', 'index.html', 'css/app.css', 'js/app.js',
  'vendor/leaflet.js', 'vendor/leaflet.css',
  'vendor/images/marker-icon.png', 'vendor/images/marker-icon-2x.png', 'vendor/images/marker-shadow.png',
  'data/dias.json?v=2026-08-27-11', 'data/lugares.geo.json?v=2026-08-27-11', 'data/rutas.json?v=2026-08-27-11',
  'data/tours.json?v=2026-08-27-11', 'data/reservas.json?v=2026-08-27-11', 'data/fichas.json?v=2026-08-27-11', 'data/audio.json?v=2026-08-27-11', 'data/interiores.json?v=2026-08-27-11',
  'manifest.webmanifest', 'icons/icono-180.png', 'icons/icono-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V && x !== 'teselas' && x !== 'audio').map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // teselas del mapa: se guardan segun se van viendo, y luego valen sin cobertura
  if (u.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(caches.open('teselas').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  // el audio se guarda segun se escucha, y ademas hay un boton para bajarlo entero
  if (u.origin === location.origin && u.pathname.includes('/audio/')) {
    e.respondWith(caches.open('audio').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (u.origin !== location.origin) return;

  // lo propio: primero la red, y si no hay, lo guardado
  e.respondWith(fetch(e.request)
    .then(r => { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
