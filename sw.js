// =============================================
//  NIGHTR - Service Worker
//  Le numéro de version change à chaque déploiement
//  → force le navigateur à vider le cache
// =============================================

const VERSION = 'nightr-v__BUILD__'; // remplacé dynamiquement, sinon utilise la date
const CACHE = VERSION.includes('BUILD') ? 'nightr-v' + Date.now() : VERSION;

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
];

// Installation : met les assets en cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  // Force l'activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
});

// Activation : supprime TOUS les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Suppression ancien cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// Fetch : Network-first pour HTML (toujours frais), Cache-first pour assets statiques
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase et APIs externes → toujours réseau
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // index.html → network-first (pour avoir toujours la dernière version)
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Autres assets → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
