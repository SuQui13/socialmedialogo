const CACHE_NAME = "social-photo-exporter-mobile-v1";
const CORE_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "pwa.js",
  "manifest.webmanifest",
  "pt/",
  "pt/index.html",
  "pt/app.js",
  "pt/manifest.webmanifest",
  "icons/app-icon.svg",
  "icons/app-icon-180.png",
  "icons/app-icon-192.png",
  "icons/app-icon-512.png",
  "frames/apcm-4x5.png",
  "frames/apcm-story.png",
  "frames/apcm-16x9.png",
  "vendor/tracking/tracking-min.js",
  "vendor/tracking/data/face-min.js",
  "vendor/mp4-muxer/mp4-muxer.js",
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS.map(scopedUrl)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (requestUrl.origin !== scopeUrl.origin || requestUrl.pathname.startsWith(`${scopeUrl.pathname}api/`)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;

      if (event.request.mode === "navigate") {
        const portuguese = requestUrl.pathname.startsWith(`${scopeUrl.pathname}pt/`);
        return caches.match(scopedUrl(portuguese ? "pt/index.html" : "index.html"));
      }

      return Response.error();
    }
  })());
});
