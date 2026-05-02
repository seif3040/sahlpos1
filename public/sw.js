// Simple offline-first service worker for the POS app shell.
// Caches static assets and serves them when offline. Network requests
// to Supabase or APIs always go to the network (with no offline writes).
const CACHE = "pos-shell-v1";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Bypass Supabase, APIs, and dev HMR
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("supabase") ||
    url.pathname.startsWith("/_") ||
    url.pathname.startsWith("/@")
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            if (res.ok && (res.type === "basic" || res.type === "default")) {
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => caches.match("/")),
    ),
  );
});
