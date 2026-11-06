const APP_SHELL_CACHE = 'himart-shell-v24';
const DATA_JSON_CACHE = 'himart-data-v24';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app-manifest.json',
  './icon.svg',
  './favicon-32x32.png',
  './pwa-192x192.png',
  './care-table-data.json',
  './card-installment-data.json',
  './schedule-data.json',
  './model-incentive-data.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url, { cache: 'no-cache' }).then((res) => {
              if (res && res.ok) {
                return cache.put(url, res);
              }
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([APP_SHELL_CACHE, DATA_JSON_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!validCaches.has(cacheName)) {
              return caches.delete(cacheName);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 외부 API 호출 및 Vite 개발 모듈/API 라우트는 캐싱 제외
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('github.com') ||
    url.hostname.includes('githubusercontent.com') ||
    url.hostname.includes('script.google.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@')
  ) {
    return;
  }

  // 1) 데이터 JSON 파일 (조견표, 무이자표, 휴무표): Network-First (no-store) + 오프라인 캐시 폴백
  if (url.pathname.endsWith('-data.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(DATA_JSON_CACHE).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            return new Response('{}', {
              headers: { 'Content-Type': 'application/json' },
            });
          })
        )
    );
    return;
  }

  // 2) 페이지 네비게이션 (HTML): Network-First + 오프라인 시 캐시된 index.html 즉시 반환
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put('./index.html', clone));
          }
          return networkRes;
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((cached) => cached || caches.match('./') || Response.error())
        )
    );
    return;
  }

  // 3) 정적 에셋 (JS/CSS 번들, 폰트, 이미지): Network-First + 오프라인 캐시 폴백 (업데이트 즉시 반영 보장)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || Response.error()))
    );
    return;
  }
});

// 🔔 Push Event: 백그라운드 푸시 수신 시 모바일 상단 알림 표시
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 국지CRM 알림',
    body: '오늘 배송 일정 및 신규 고객 알림을 확인하세요.',
    url: './',
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: './icon.svg',
    badge: './icon.svg',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || './',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 🔔 Notification Click: 알림 탭(클릭) 시 앱 창 열기 및 목표 화면 안전 라우팅
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    './?source=pwa&entry=briefing';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
            try {
              client.postMessage({
                type: 'HIMART_PUSH_NAVIGATE',
                url: targetUrl,
              });
            } catch (e) {
              // ignore postMessage error
            }
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
