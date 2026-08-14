// DareStake Service Worker v2
const CACHE_VERSION = "darestake-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// App shell -- cached on install
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
];

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith("http")) return;

  // Network-first: API calls, Firebase, external services
  if (
    url.pathname.startsWith("/api") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("identitytoolkit")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first: static assets (fonts, icons, images, CSS/JS chunks)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for navigation (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return cached root as offline fallback
    const offlinePage = await caches.match("/");
    if (offlinePage) return offlinePage;

    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DareStake - Offline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0F0F0F;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}.container{max-width:320px}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.5rem;margin-bottom:0.5rem;color:#F59E0B}p{color:rgba(255,255,255,0.6);line-height:1.5}button{margin-top:1.5rem;padding:0.75rem 1.5rem;background:#F59E0B;color:#0F0F0F;border:none;border-radius:0.75rem;font-weight:600;cursor:pointer}</style></head><body><div class="container"><div class="icon">⚡</div><h1>You're Offline</h1><p>Check your connection and try again. Your dares are waiting!</p><button onclick="location.reload()">Retry</button></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }
}

function isStaticAsset(url) {
  const staticExtensions = [
    ".js",
    ".css",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".avif",
    ".ico",
  ];
  return (
    staticExtensions.some((ext) => url.pathname.endsWith(ext)) ||
    url.pathname.startsWith("/_next/static/")
  );
}

// ─── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {
    title: "DareStake",
    body: "You have a notification!",
    icon: "/icons/icon-192x192.svg",
    badge: "/icons/icon-192x192.svg",
    url: "/dashboard",
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    tag: data.tag || "darestake-notification",
    renotify: true,
    requireInteraction: false,
    data: { url: data.url },
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Notification Click ──────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ─── Notification Close ──────────────────────────────────────────────────────

self.addEventListener("notificationclose", () => {
  // Future: analytics tracking
});

// ─── Background Sync (future) ────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-dares") {
    event.waitUntil(
      // Future: sync pending dare completions when back online
      Promise.resolve()
    );
  }
});
