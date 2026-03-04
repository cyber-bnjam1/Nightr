// ===== sw.js — Nightr Service Worker =====
const CACHE = ‘nightr-v1’;
const ASSETS = [
‘/’, ‘/index.html’, ‘/style.css’, ‘/app.js’,
‘/page-events.js’, ‘/page-guests.js’, ‘/page-invitations.js’,
‘/page-contributions.js’, ‘/page-budget.js’, ‘/page-stats.js’,
‘/page-ambiance.js’, ‘/page-settings.js’,
‘/manifest.json’, ‘/nightr.png’
];

self.addEventListener(‘install’, e => {
e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
self.skipWaiting();
});

self.addEventListener(‘activate’, e => {
e.waitUntil(caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
));
self.clients.claim();
});

self.addEventListener(‘fetch’, e => {
// Firebase & Google requests: network only
if (e.request.url.includes(‘firebase’) || e.request.url.includes(‘google’) || e.request.url.includes(‘gstatic’)) {
return e.respondWith(fetch(e.request));
}
e.respondWith(
caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
if (res.ok) {
const clone = res.clone();
caches.open(CACHE).then(c => c.put(e.request, clone));
}
return res;
}))
);
});