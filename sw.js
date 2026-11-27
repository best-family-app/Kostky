// Kostky – offline režim. Stránka hry: nejdřív síť (aby se nové verze načetly hned),
// při pomalé nebo žádné síti po 3 s poslední uložená verze (síť se mezitím dál uloží).
// Ostatní vlastní soubory (ikony, manifest): hned z mezipaměti a na pozadí se stáhnou znovu,
// takže změna ikony nebo manifestu se projeví při dalším spuštění.
// Cizí adresy (Firebase) service worker vůbec neřeší.
const CACHE = 'kostky-v2';
const FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const NAV_TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function saveCopy(key, res) {
  if (res && res.ok) { const copy = res.clone(); return caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {}); }
  return Promise.resolve();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const net = fetch(req, { cache: 'no-cache' }).then(res => { e.waitUntil(saveCopy('./index.html', res)); return res; });
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fromCache = () => caches.match('./index.html').then(hit => hit || net);
      const timer = setTimeout(() => { if (!done) { done = true; resolve(fromCache()); } }, NAV_TIMEOUT);
      net.then(res => { if (!done) { done = true; clearTimeout(timer); resolve(res); } })
         .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fromCache()); } });
    }));
    return;
  }

  // ikony, manifest: z mezipaměti hned, aktualizace na pozadí
  const net = fetch(req, { cache: 'no-cache' }).then(res => { saveCopy(req, res); return res; });
  e.waitUntil(net.then(() => {}, () => {}));
  e.respondWith(caches.match(req).then(hit => hit || net));
});
