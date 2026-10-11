// 오프라인 지원: 앱 파일은 캐시 우선, 문제(content.json)는 네트워크 우선(3초 안에 안 오면 캐시).
// VERSION은 tools/build.mjs가 빌드할 때마다 갱신한다.
const VERSION = '20261011141129';
const CACHE = `allez-${VERSION}`;
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'mascot.js', 'content.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('allez-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function networkFirst(req, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then((r) => { if (!done && r) { done = true; resolve(r); } });
    const timer = setTimeout(fallback, timeoutMs);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      caches.match(req, { ignoreSearch: true }).then((r) => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/content.json')) {
    e.respondWith(networkFirst(e.request, 3000));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })),
  );
});
