const CACHE = "clintrack-v4";
const DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";
self.addEventListener("install", (e) => {
  if (DEV) {
    e.waitUntil(self.skipWaiting());
    return;
  }
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icon.svg", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (DEV) return;
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (!res.ok || res.redirected || url.pathname === "/login") return res;
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/"))),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "Time to check in";
  const body = payload.body || "You have not checked in today. A minute for mood, sleep, and how the day went.";
  event.waitUntil(self.registration.showNotification(title, { body, tag: "clintrack-checkin", icon: "/icon.svg", data: { url: "/" } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = all.find((entry) => new URL(entry.url).origin === self.location.origin);
    if (client) {
      await client.focus();
      client.postMessage({ type: "open-checkin" });
      return;
    }
    await self.clients.openWindow("/");
  })());
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "resubscribe" }));
  }));
});
