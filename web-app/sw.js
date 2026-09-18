// Peekaboo — Service Worker Tactique (Air-Gap PWA)
const CACHE_NAME = "peekaboo-cache-v1.5.0";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./pricing-config.js",
  "./analytics.js",
  "./manifest.webmanifest",
  "./logo.svg",
  "./icon-192.svg",
  "./icon-512.svg",
  "./soundtrack.js",
  "./og-image.svg",
  "./twitter-image.svg",
  "./security-manifest.json",
  "./flyer-cyberpunk.jpg",
  "./flyer-pro.html",
  "./flyer.html",
  "./infographie-notebooklm.html"
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

// Interception des requêtes : Network-First pour app.js et index.html si en ligne, Cache-First pour les assets statiques
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith("http")) return;

  const url = new URL(event.request.url);
  const isCodeAsset = url.pathname.endsWith("app.js") || url.pathname.endsWith("index.html") || url.pathname === "/";

  if (isCodeAsset) {
    // Si connecté, essayer de récupérer la version fraîche pour éviter le blocage du cache
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Autres assets (images, fonts, manifest) : Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
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
