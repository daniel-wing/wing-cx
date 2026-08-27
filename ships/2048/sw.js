/**
 * Service worker — offline support.
 *
 * The game is entirely local, so "offline" simply means the app shell and its
 * JS bundle need to be served from cache. There is no API to sync and no data
 * to reconcile.
 *
 * Strategy:
 *   - Navigations: network-first, falling back to the cached shell. Keeps the
 *     app fresh on redeploys while still working with no connection.
 *   - Everything else (hashed bundles, fonts, icons): cache-first, since those
 *     filenames change when their content changes.
 */

/*
  Bumped on every release that changes what is cached.

  It used to be a fixed string, which made the activate-time cleanup below a
  permanent no-op: every hashed bundle from every past deploy accumulated in
  Cache Storage forever. Users were never pinned to a stale build — navigations
  are network-first and assets are content-hashed — but storage grew by a couple
  of megabytes per deploy with nothing ever evicting it.
*/
const CACHE = '2048-adfree-v2';

// Derived from where this worker is served rather than hard-coded, so the same
// file works at the domain root during local testing and under /ships/2048/ in
// production. `new URL('./', location)` is the worker's own directory.
const SHELL = new URL('./', self.location).pathname;
const SCOPE_PREFIX = SHELL;

/*
  `skipWaiting` + `clients.claim` below mean a new worker takes over open tabs
  immediately rather than waiting for every tab to close.

  That is safe HERE, and the reason is worth writing down: the app ships as a
  single bundle with no code splitting and no lazy chunks, so a tab running the
  old document can never ask for a chunk the new deploy has replaced. Introduce
  code splitting and this stops being true — the running page would start
  fetching new-build chunks against old-build expectations.
*/
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL, SHELL + 'manifest.json']))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever handle same-origin GETs inside this app's own sub-path. The app
  // makes no cross-origin requests, and staying inside the scope means the
  // worker can never interfere with the rest of wing.cx.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The slash-less form (/ships/2048) is outside SCOPE_PREFIX, so it is left to
  // the network — the host redirects it to the canonical trailing-slash url,
  // which this worker does control.
  if (!url.pathname.startsWith(SCOPE_PREFIX)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          /*
            Only the shell's OWN url refreshes the shell.

            This used to run for every navigation, so visiting /about overwrote
            the cached root — and offline, opening the game then served the
            About document, with the wrong title and the wrong initial route.

            `response.ok` guards `cache.put`, which rejects on a non-2xx, and
            `waitUntil` keeps the worker alive until the write finishes instead
            of leaving a floating promise that may be killed mid-flight.
          */
          if (response.ok && url.pathname === SHELL) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(SHELL, copy))
                .catch(() => {
                  /* A failed cache write must never break the navigation. */
                }),
            );
          }
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached || caches.match(request))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {
                /* Out of quota, most likely. Serving the response still works. */
              }),
          );
        }
        return response;
      });
    }),
  );
});
