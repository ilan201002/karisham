// P1-6: גרסה מוזרקת אוטומטית ע"י vite.config.js בכל build
const CACHE = "karisham-__SW_VERSION__";
const STATIC = ["/", "/index.html"];

self.addEventListener("install", e => {
  // לא קוראים אוטומטית ל-skipWaiting — נחכה שהמשתמש יאשר רענון ב-UI
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
});

// P1-6: SW מאזין להודעה מה-UI כדי לאמץ את הגרסה החדשה
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Let Supabase API calls pass through
  if (url.hostname.includes("supabase.co")) return;
  // SPA navigation fallback — serve index.html for all navigation requests
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html"))
    );
    return;
  }
  // Network-first for all other GET requests
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
