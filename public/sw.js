const CACHE_NAME = 'himart-shell-v70';
const DATA_CACHE_NAME = 'himart-data-v70';
const APP_SHELL = ['./', './index.html', './app-manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((u) =>
          fetch(u, { cache: 'reload' })
            .then((res) => (res && res.ok ? cache.put(u, res) : null))
            .catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                (k.startsWith('himart-shell-') || k.startsWith('himart-data-')) &&
                k !== CACHE_NAME &&
                k !== DATA_CACHE_NAME
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Data JSON files: Network-First, fallback to cache
  if (url.pathname.endsWith('-data.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML navigation requests bypass browser HTTP cache (max-age=600) so new bundles reflect immediately
  const isHtmlNav =
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html');

  event.respondWith(
    fetch(request, isHtmlNav ? { cache: 'reload' } : undefined)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((res) => res || caches.match('./index.html')))
  );
});
