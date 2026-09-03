const SHELL_CACHE = "pundi-shell-v8.7.2";
const SHELL = ["/", "/app.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put("/app.html", copy));
      return response;
    }).catch(() => caches.match("/app.html")));
    return;
  }

  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    })));
  }
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
