/* Sakhi service worker.
 *
 * Goal: the app opens and the pages a woman needs most still work when the
 * network does not — which in the districts this is built for is most of the
 * time, not an edge case.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NEVER CACHED, AND WHY
 * ---------------------------------------------------------------------------
 * Anything under /api. Not triage results, not anaemia scores, not the session
 * list, not the account profile.
 *
 * A cached API response is health data written to the device's disk, where it
 * outlives the tab, survives a sign-out, and is readable by anyone who later
 * picks up a shared phone. The whole design of this app is that a girl can ask
 * about a symptom without leaving a trace; a helpful offline cache would quietly
 * undo that. Static assets — the shell, the icons, the stylesheet — carry no
 * information about anyone, so they are cached freely.
 */

const VERSION = "sakhi-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

// Vite emits content-hashed filenames, so the asset list cannot be known when
// this file is written. The shell is precached by URL and everything else is
// picked up at runtime on first successful load.
const SHELL = ["/", "/index.html", "/site.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll is atomic: one 404 would throw away the whole precache, and a
      // missing icon should not cost the app its offline shell.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const isAsset = (url) => /\.(js|css|woff2?|png|svg|jpe?g|webp|ico)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Health data never touches the disk. Let it go straight to the network; if
  // that fails the page handles it and says so.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first so content stays fresh, cached shell as the
  // fallback so a dead connection still opens the app rather than a browser
  // error page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: cache first. They are content-hashed, so a cached copy is
  // never stale — a new build produces a new filename.
  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});

// Lets the page drop every cached byte on request — the "clear everything on
// this device" affordance a shared phone needs.
self.addEventListener("message", (event) => {
  if (event.data === "sakhi:purge") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
