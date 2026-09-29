/* ============================================================
   Service Worker — سوبرماركت أبو الحسن
   استراتيجية: Cache-First للأصول، Network-First للـ HTML
   ============================================================ */

const CACHE_VERSION = 'abuhassan-v1.0.0';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
    './',
    './index.html',
    './admin.html',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap'
];

const NEVER_CACHE_PATTERNS = [
    /wa\.me/,
    /whatsapp\.com/,
    /google-analytics/,
    /googletagmanager/
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return Promise.allSettled(
                PRECACHE_URLS.map(url =>
                    cache.add(url).catch(err => console.warn('[SW] Precache failed:', url, err.message))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter(key => key.startsWith('abuhassan-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET') return;
    if (NEVER_CACHE_PATTERNS.some(p => p.test(url.href))) return;
    if (url.protocol === 'chrome-extension:') return;

    if (request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(networkFirst(request));
        return;
    }
    event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
        const response = await fetch(request);
        if (response && response.status === 200) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request) || await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
        return new Response(
            '<h1>أنت غير متصل</h1><p>تعذر تحميل الصفحة. يرجى التحقق من الإنترنت.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.status === 200 && response.type !== 'opaque') {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        if (request.destination === 'image') {
            return new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e2e8f0"/><text x="200" y="150" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#166534">أبو الحسن</text></svg>`,
                { headers: { 'Content-Type': 'image/svg+xml' } }
            );
        }
        throw err;
    }
}

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'CLEAR_CACHE') caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
});