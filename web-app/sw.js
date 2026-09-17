// Peekaboo — Service Worker Tactique (Air-Gap PWA)
const CACHE_NAME = "peekaboo-cache-v1.4.2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./logo.svg",
  "./icon-192.svg",
  "./icon-512.svg",
  "./soundtrack.js",
  "./security-manifest.json"
];

// Installation : mise en cache des assets critiques
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // NOTE DE SÉCURITÉ : Ne pas faire self.skipWaiting() ici automatiquement
  // afin de ne pas interrompre une session cryptographique en cours.
});

// Activation : nettoyage des anciens caches obsolètes
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes : Stratégie Cache-First pour garantir le mode Avion
self.addEventListener("fetch", (event) => {
  // Ignorer les schémas non supportés
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // En cas de panne réseau complète (Mode Avion) sur une navigation HTML
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});

// Communication client : mise à jour explicite et contrôlée
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
