const CACHE_NAME = "som-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://unpkg.com/html5-qrcode",
  "https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  // Hanya intercept GET request (aset UI). POST request (GAS API) akan ditangani IndexedDB & fetch biasa.
  if(e.request.method === "GET") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
