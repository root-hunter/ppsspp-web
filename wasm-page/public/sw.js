/**
 * PPSSPP Web – Service Worker
 *
 * Strategy:
 *  - App shell (index.html, manifest, sw itself) → Network-first with cache fallback
 *  - WASM / JS / asset files                     → Cache-first (immutable builds)
 *  - Everything else                              → Network-only (pass-through)
 *
 * The cache is versioned; old caches are pruned on activate.
 */

const CACHE_VERSION = "ppsspp-angular-v11-network-invites";

// Files that form the app shell – fetched fresh every time if online
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./ppsspp-runtime.js",
  "./adhoc-transport.js",
];

// Extensions considered immutable build artifacts → cache-first
const IMMUTABLE_EXTS = /\.(wasm|js|data|mem|zim|meta|png|svg|ico|webp|json|txt|css)$/i;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_FILES))
      .catch(() => {}) // Cache denial/quota must not prevent COOP/COEP activation.
      .then(() => self.skipWaiting())
  );
});

// ── Activate  ────────────────────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("ppsspp-") && key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).catch(() => {}).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // App shell → network-first, fallback to cache
  const isShell = pathname.endsWith("/") ||
                  pathname.endsWith("/index.html") ||
                  pathname.endsWith("/manifest.webmanifest") ||
                  pathname.endsWith("/ppsspp-runtime.js") ||
                  pathname.endsWith("/build-info.json") ||
                  pathname.endsWith("/assets-manifest.txt");

  if (isShell) {
    event.respondWith(networkFirst(request, event));
    return;
  }

  // Immutable build artifacts → cache-first
  if (IMMUTABLE_EXTS.test(pathname)) {
    event.respondWith(cacheFirst(request, event));
    return;
  }

  // Everything else (serve.py API, etc.) → network only
});

// ── Strategies ───────────────────────────────────────────────────────────────

async function openCache() {
  try { return await caches.open(CACHE_VERSION); } catch (_) { return null; }
}

async function cachedResponse(cache, request) {
  try { return await cache?.match(request); } catch (_) { return null; }
}

async function networkFirst(request, event) {
  const cache = await openCache();
  try {
    const response = withCrossOriginIsolation(await fetch(request));
    if (response.ok && cache) {
      const write = cache.put(request, response.clone()).catch(() => {});
      event?.waitUntil(write);
    }
    return response;
  } catch (_) {
    const cached = await cachedResponse(cache, request);
    return cached ? withCrossOriginIsolation(cached) : withCrossOriginIsolation(new Response("Offline – PPSSPP Web is not cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    }));
  }
}

async function cacheFirst(request, event) {
  const cache = await openCache();
  const cached = await cachedResponse(cache, request);
  if (cached) return withCrossOriginIsolation(cached);
  try {
    const response = withCrossOriginIsolation(await fetch(request));
    if (response.ok && cache) {
      const write = cache.put(request, response.clone()).catch(() => {});
      event?.waitUntil(write);
    }
    return response;
  } catch (err) {
    return withCrossOriginIsolation(new Response("Network error: " + err.message, {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    }));
  }
}

function withCrossOriginIsolation(response) {
  if (!response || response.type === "opaque") return response;

  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
