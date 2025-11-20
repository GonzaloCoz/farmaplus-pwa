// Service Worker para Farmaplus PWA
// Versión del caché - incrementar cuando haya cambios
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `farmaplus-${CACHE_VERSION}`;

// Determine the base URL for the service worker
const BASE_URL = self.location.pathname.replace('/service-worker.js', '/');

// Recursos para precarga (assets críticos)
const PRECACHE_URLS = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}logo.png`,
  `${BASE_URL}manifest.json`,
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precargando recursos críticos');
      return cache.addAll(PRECACHE_URLS);
    })
  );

  // Activar inmediatamente el nuevo service worker
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Tomar control de todas las páginas inmediatamente
  return self.clients.claim();
});

// Estrategia de caché
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no sean del mismo origen (APIs externas, etc.)
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia: Cache First para assets estáticos
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Estrategia: Network First para HTML y datos
  if (
    request.destination === 'document' ||
    request.method === 'GET'
  ) {
    event.respondWith(networkFirst(request));
    return;
  }
});

// Cache First: Intenta servir desde caché, si no hay, va a la red
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Cachear la respuesta si es exitosa
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Error en fetch:', error);

    // Retornar página offline si está disponible
    return caches.match(`${BASE_URL}index.html`);
  }
}

// Network First: Intenta la red primero, si falla usa caché
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cachear la respuesta si es exitosa
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Red no disponible, usando caché');

    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no hay caché, retornar página principal
    return caches.match(`${BASE_URL}index.html`);
  }
}

// Background Sync para sincronización offline
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync:', event.tag);

  if (event.tag === 'sync-inventory') {
    event.waitUntil(syncInventoryData());
  }
});

async function syncInventoryData() {
  try {
    // Aquí puedes implementar la lógica de sincronización
    // Por ejemplo, enviar datos guardados offline al servidor
    console.log('[SW] Sincronizando datos de inventario...');

    // Obtener datos pendientes de localStorage (si los hay)
    // y enviarlos al servidor

    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Error en sincronización:', error);
    return Promise.reject(error);
  }
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido');

  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: `${BASE_URL}logo.png`,
    badge: `${BASE_URL}logo.png`,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification('Farmaplus', options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación');

  event.notification.close();

  event.waitUntil(
    clients.openWindow(BASE_URL)
  );
});