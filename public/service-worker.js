const CACHE_NAME = "farmaplus-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/offline.html",
  "/logo.png"
];

const self = this;

// Instalar el Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache abierto");
      return cache.addAll(urlsToCache);
    })
  );
});

// Escuchar peticiones
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si la petición está en caché, la devolvemos. Si no, la buscamos en la red.
      // Si la red falla, mostramos la página offline.
      return response || fetch(event.request).catch(() => caches.match("/offline.html"));
    })
  );
});

// Activar el Service Worker y limpiar cachés antiguas
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});