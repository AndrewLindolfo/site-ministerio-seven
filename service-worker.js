const CACHE_NAME = "ministerio-seven-v1";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/musicas.html",
  "/cifras.html",
  "/agenda.html",
  "/fotos.html",
  "/downloads.html",
  "/contato.html",
  "/assets/css/main.css",
  "/assets/css/theme.css",
  "/assets/css/layout.css",
  "/assets/js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
