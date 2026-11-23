const CACHE_VERSION = "gastromap-v2";
const RUNTIME_CACHE = "gastromap-runtime-v2";
const TILES_CACHE = "gastromap-tiles-v1";
const MAX_TILES_ENTRIES = 600;

const PRECACHE_URLS = [
  "/",
  "/new",
  "/manifest.json",
  "/icon.svg",
];

// Helper para limitar tamaño de caché (ej. teselas de mapas)
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch (_) {}
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Precache advertencia:", err);
      })
  );
});

self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_VERSION, RUNTIME_CACHE, TILES_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo peticiones GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. Teselas de mapas (OpenStreetMap, CartoDB, etc.)
  if (
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.includes("basemaps.cartocdn.com") ||
    url.pathname.includes("/tile/")
  ) {
    event.respondWith(
      caches.open(TILES_CACHE).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
                trimCache(TILES_CACHE, MAX_TILES_ENTRIES);
              }
              return networkResponse;
            })
            .catch(() => {
              return new Response("", { status: 408, headers: { "Content-Type": "image/png" } });
            });
        })
      )
    );
    return;
  }

  // 2. Chunks estáticos de Next.js, fuentes, iconos (inmutables -> Cache First con actualización)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(woff2?|ttf|eot|png|jpg|jpeg|svg|webp|ico|css|js)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Documentos HTML y navegación de páginas (Network First con fallback a caché y a '/')
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match("/").then((rootCached) => rootCached || new Response("GastroMap Offline", { status: 503 }));
          })
        )
    );
    return;
  }

  // 4. Recursos del mismo origen (Stale-While-Revalidate)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});
