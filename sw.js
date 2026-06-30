/* ═══════════════════════════════════════════════════
   Edu Prime — Service Worker  (sw.js)
   Strategy:
     • Shell / static assets  → Cache First
     • Firebase API calls      → Network First
     • YouTube / external      → Network Only
   ═══════════════════════════════════════════════════ */

const APP_VERSION  = 'edu-prime-v1';
const CACHE_STATIC = `${APP_VERSION}-static`;
const CACHE_PAGES  = `${APP_VERSION}-pages`;
const CACHE_IMAGES = `${APP_VERSION}-images`;

/* ── Files to pre-cache on install ── */
const PRECACHE_URLS = [
  './',
  './index.html',
  './batch.html',
  './settings.html',
  './study.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  /* Offline fallback page */
  './offline.html'
];

/* ── Domains to never cache ── */
const NETWORK_ONLY = [
  'firebaseio.com',
  'googleapis.com',
  'firebase.google.com',
  'youtube.com',
  'youtu.be',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

/* ══════════════════════════════════════════════
   INSTALL — pre-cache shell
   ══════════════════════════════════════════════ */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache partial fail:', err);
      });
    })
  );
});

/* ══════════════════════════════════════════════
   ACTIVATE — remove old caches
   ══════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('edu-prime-') && k !== CACHE_STATIC && k !== CACHE_PAGES && k !== CACHE_IMAGES)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ══════════════════════════════════════════════
   FETCH — routing logic
   ══════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* 1. Skip non-GET */
  if (request.method !== 'GET') return;

  /* 2. Network-only for Firebase / YouTube / Fonts */
  if (NETWORK_ONLY.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(request));
    return;
  }

  /* 3. HTML pages → Network First, fall back to cache, then offline.html */
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  /* 4. Images → Cache First */
  if (request.destination === 'image') {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  /* 5. Static assets (CSS, JS, fonts) → Cache First */
  event.respondWith(cacheFirstStatic(request));
});

/* ── Strategy: Network First (HTML) ── */
async function networkFirstHTML(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_PAGES);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('./offline.html');
  }
}

/* ── Strategy: Cache First (Images) ── */
async function cacheFirstImage(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_IMAGES);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

/* ── Strategy: Cache First (Static) ── */
async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_STATIC);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

/* ══════════════════════════════════════════════
   PUSH NOTIFICATIONS (Future use)
   ══════════════════════════════════════════════ */
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title   = data.title   ?? 'Edu Prime';
  const options = {
    body:    data.body    ?? 'New update available!',
    icon:    data.icon    ?? './icons/icon-192.png',
    badge:   data.badge   ?? './icons/icon-96.png',
    vibrate: [100, 50, 100],
    data:    { url: data.url ?? './' },
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url ?? './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url === url && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
