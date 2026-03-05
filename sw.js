var CACHE = 'nightr-v3';
var FILES = ['/', '/index.html', '/nightr.css', '/nightr.js', '/manifest.json'];
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);})); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  if (e.request.url.indexOf('firebase') > -1 || e.request.url.indexOf('gstatic') > -1 || e.request.url.indexOf('googleapis') > -1 || e.request.url.indexOf('cdnjs') > -1) {
    e.respondWith(fetch(e.request).catch(function(){ return caches.match(e.request); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(cached){
    if (cached) return cached;
    return fetch(e.request).then(function(resp){
      if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
      var clone = resp.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
      return resp;
    });
  }));
});
