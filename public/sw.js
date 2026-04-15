// DeskHive Service Worker — v2
// Strategies:
//   /_next/static/**  → Cache First (immutable builds)
//   /pwa-icon/**      → Cache First
//   /api/**           → Network Only  (email / server actions)
//   Firebase / Google → Network Only  (auth, Firestore)
//   Everything else   → Network First with cache fallback → /offline

const STATIC_CACHE = "dh-static-v2";
const PAGE_CACHE   = "dh-pages-v2";
const KNOWN_CACHES = [STATIC_CACHE, PAGE_CACHE];

const OFFLINE_URL  = "/offline";

// Pages to precache on install
const PRECACHE_PAGES = [
  "/",
  "/tickets",
  "/customers",
  "/analytics",
  "/users",
  "/settings",
  OFFLINE_URL,
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) =>
        // addAll is best-effort — ignore individual failures
        Promise.allSettled(PRECACHE_PAGES.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !KNOWN_CACHES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Message (skip waiting) ────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin, Firebase, Google auth, Resend
  if (url.origin !== self.location.origin) return;

  // Skip Next.js dev/HMR websocket upgrades
  if (request.headers.get("upgrade") === "websocket") return;

  // ── Cache First: immutable static assets ──────────────────────────────────
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa-icon/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Network Only: API routes ───────────────────────────────────────────────
  if (url.pathname.startsWith("/api/")) return;

  // ── Network First: app pages ───────────────────────────────────────────────
  event.respondWith(networkFirst(request));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Last resort — serve offline page
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response("You are offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
