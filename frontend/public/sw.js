/* MeteoWeb's service worker. It exists so that the installed app shows
   its own «no connection» page instead of the browser's. It caches nothing else: readings
   and video are live, and the build's hashed assets are already kept by the HTTP cache.
   Served at /sw.js by the backend (meteoweb.pwa) and registered by src/lib/pwa.ts. */
const CACHE = "offline-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Also drops the precache of the workbox worker this one replaces.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      // The page request starts while the worker boots, so having one costs no time per open.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

// The offline page is stored in one language; a page loaded in another stores it again.
async function refreshOffline(response) {
  const language = response.headers.get("Content-Language");
  if (!language) return;
  const cache = await caches.open(CACHE);
  const stored = await cache.match(OFFLINE);
  if (stored?.headers.get("Content-Language") !== language) await cache.add(OFFLINE);
}

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const response = (await event.preloadResponse) ?? (await fetch(event.request));
        event.waitUntil(refreshOffline(response));
        return response;
      } catch {
        return (await caches.match(OFFLINE)) ?? Response.error();
      }
    })(),
  );
});
