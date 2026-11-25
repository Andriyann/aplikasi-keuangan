const cacheName = "myuang-shell-v1.0.2";
const files = [
  "./myuang.html",
  "./myuang.css",
  "./app.webmanifest",
  "./js/finance.js",
  "./js/app.js",
  "./js/language.js",
  "./js/actions.js",
  "./js/storage.js",
  "./media/wallet-stack.webp",
  "./media/icon-192.png",
  "./media/icon-512.png",
  "./media/inter-variable.woff2",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(cacheName)
      .then((c) => c.addAll(files))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(
          ks
            .filter((k) => k.startsWith("myuang-shell-") && k !== cacheName)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    (!files.some((f) => new URL(f, self.location).pathname === url.pathname) &&
      !url.pathname.startsWith("/vendor/"))
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then(async (r) => {
        if (r.ok && !r.redirected)
          (await caches.open(cacheName)).put(event.request, r.clone());
        return r;
      })
      .catch(() =>
        caches.match(event.request).then((r) => r || Response.error()),
      ),
  );
});
