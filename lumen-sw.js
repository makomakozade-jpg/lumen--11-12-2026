/* Lumen service worker
   - the app page: always asks the network first (so a new version shows up on the next open),
     and falls back to the saved copy when you are offline
   - icons and the manifest: served instantly, refreshed in the background
   - Google Fonts: saved after the first time, so lettering also works offline
   Change VERSION to wipe the saved copies and start fresh. */
const VERSION = "lumen-final-1";
const PAGES = "lumen-pages-" + VERSION;
const FONTS = "lumen-fonts";
const APP = "lumen-final.html";
const SHELL = [APP, "lumen-manifest.json", "lumen-icon-192.png", "lumen-icon-512.png", "lumen-icon-maskable.png", "lumen-apple-touch.png"];
const abs = (p) => new URL(p, self.registration.scope).href;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => Promise.all(SHELL.map((u) => c.add(abs(u)).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== PAGES && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function page(req, url) {
  const cache = await caches.open(PAGES);
  const key = url.pathname.endsWith(".html") ? url.origin + url.pathname : abs(APP);   // ignore ?ls=... style extras
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  } catch (_) {
    return (await cache.match(key)) || (await cache.match(abs(APP))) || Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(PAGES), hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}
async function fontFirst(req) {
  const cache = await caches.open(FONTS), hit = await cache.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }
  catch (_) { return Response.error(); }
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate" || url.pathname.endsWith(".html")) e.respondWith(page(req, url));
    else e.respondWith(staleWhileRevalidate(req));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(fontFirst(req));
  }
});
