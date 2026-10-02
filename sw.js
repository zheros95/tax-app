const CACHE_NAME = 'tax-calculator-v24';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/tax_calculator.js',
    './js/region_data.js',
    './js/hwpx_form_filler.js',
    './manifest.json',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/hero.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS).catch((err) => console.log('Cache addAll failed', err)))
    );
    self.skipWaiting();
});

// 이전 버전 캐시 삭제
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    // 페이지(HTML)는 네트워크 우선: 배포 직후 첫 접속에도 새 화면을 보여주고, 오프라인일 때만 캐시를 쓴다.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // CSS·JS·이미지는 ?v= 버전이 붙어 있어 캐시 우선으로 충분하다. 오프라인이면 버전 무시하고 찾는다.
    event.respondWith(
        caches.match(request)
            .then((cached) => cached || fetch(request))
            .catch(() => caches.match(request, { ignoreSearch: true }))
    );
});
