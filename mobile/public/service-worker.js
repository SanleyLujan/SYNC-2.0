// Service Worker do Sync PWA
// Estratégias:
//   - navegação/HTML: network-first com fallback offline
//   - assets versionados (JS, CSS, fontes): cache-first
//   - imagens (Unsplash, avatares): stale-while-revalidate
//   - tiles (OSM): cache-first até 7 dias
//   - API, documentos privados e requisições autenticadas: somente rede

const VERSION = 'sync-v8-csp-20261109';
const SHELL = `sync-shell-${VERSION}`;
const IMAGES = `sync-images-${VERSION}`;
const TILES = `sync-tiles-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Apenas GET é cacheado
  if (req.method !== 'GET') return;

  // Nunca reutilizar dados de outra conta, uma live revogada ou documentos
  // privados. Precisa vir ANTES da regra genérica de imagens (inclusive .jpg).
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/storage/v1/') ||
      req.headers.has('Authorization') || req.cache === 'no-store') return;

  // The Google bridge must pick up the current policy/protocol after a deploy.
  if (url.origin === self.location.origin &&
      ['/google-signin.html', '/google-signin.js', '/google-signin.css'].includes(url.pathname)) return;

  // O manifesto pode mudar a cada deploy; não deve ficar preso no cache-first.
  if (url.origin === self.location.origin && url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(req, SHELL, 0));
    return;
  }

  // O HTML precisa vir da rede primeiro. Usar cache-first aqui pode manter um
  // index.html antigo apontando para bundles removidos em um novo deploy.
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // OpenStreetMap tiles → cache-first (longa duração)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(req, TILES));
    return;
  }

  // Imagens externas (Unsplash, uploads do backend) → stale-while-revalidate
  if (
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(url.pathname) ||
    url.hostname.includes('unsplash.com') ||
    url.pathname.startsWith('/uploads/')
  ) {
    event.respondWith(staleWhileRevalidate(req, IMAGES));
    return;
  }

  // Assets versionados do app → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, SHELL));
    return;
  }
});

async function networkFirstNavigation(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(req)) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/')) ||
      new Response('Offline', { status: 503 })
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(req, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cloned = res.clone();
      // Adiciona timestamp ao header pra TTL
      const headers = new Headers(cloned.headers);
      headers.set('sw-fetched-at', Date.now().toString());
      const body = await cloned.blob();
      cache.put(req, new Response(body, { status: res.status, headers }));
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) {
      const fetchedAt = parseInt(cached.headers.get('sw-fetched-at') || '0', 10);
      if (Date.now() - fetchedAt < maxAgeMs) return cached;
    }
    return cached || new Response('Offline', { status: 503 });
  }
}

// Push notifications via SW
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Sync';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png?v=20260906',
    badge: '/favicon.png?v=20260906',
    data: data.data || {},
    tag: data.tag || 'sync-notification',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
