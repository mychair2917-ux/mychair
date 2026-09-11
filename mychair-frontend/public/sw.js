/**
 * MyChair PWA Service Worker
 * 
 * STRICT CACHING POLICY:
 * - NO API caching (/api/v1/* and all business endpoints are STRICTLY network-only)
 * - NO offline mutations or business write queues
 * - NO caching of authentication tokens, cookies, or user session data
 * - Static assets (Content-hashed JS, CSS, icons, fonts) use cache-first
 * - Navigation requests fall back to /offline.html ONLY when device is disconnected
 */

const CACHE_NAME = 'mychair-static-v3';
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
];

// Install: Cache critical static shell assets & activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: Claim clients & purge any obsolete cache buckets
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Enforce network-only for all business APIs and handle static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NON-GET or WebSocket requests: STRICTLY Network-only
  if (request.method !== 'GET' || url.protocol.startsWith('ws')) {
    return;
  }

  // 2. CRITICAL RULE: ALL Business API requests (/api/*, /api/v1/*) are STRICTLY Network-only
  // Never intercept, cache, or offline-queue business endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/api/v1/') ||
    url.pathname.includes('/api/') ||
    request.headers.has('authorization') ||
    request.headers.has('Authorization') ||
    request.headers.has('X-Tenant-ID')
  ) {
    return;
  }

  // 3. Cross-origin requests: Only cache Google Web Fonts; all other origins (API backends) are strictly network-only
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          });
        })
      );
    }
    return;
  }

  // 4. HTML Navigation requests: Network-first, fall back to /offline.html when disconnected
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/offline.html').then((offlineResponse) => {
          return offlineResponse || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  // 5. Static assets (Content-hashed JS, CSS, images, icons): Cache-first with network fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => cachedResponse);
      })
    );
    return;
  }

  // 6. Default fallback: network
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

