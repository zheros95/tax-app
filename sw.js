const CACHE_NAME = 'tax-calculator-v1';
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

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // cache.addAll(ASSETS); 에러가 나더라도 설치되도록 처리
                return cache.addAll(ASSETS).catch(err => console.log('Cache addAll failed', err));
            })
    );
});

// Activate Event: 이전 캐시 삭제
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 캐시에 있으면 반환, 없으면 네트워크 요청
                return response || fetch(event.request);
            }).catch(() => {
                return caches.match('./index.html');
            })
    );
});
