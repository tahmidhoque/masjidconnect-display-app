// This service worker can be customized!
// See https://developers.google.com/web/tools/workbox/modules
// for the list of available Workbox modules, or add any other
// code you'd like.

/* eslint-disable no-restricted-globals */

// Import Workbox libraries from CDN during service worker install
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js",
);

// Precache all the files generated during build time
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Cache the Google Fonts stylesheets with a stale-while-revalidate strategy
workbox.routing.registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
  }),
);

// Cache the Google Fonts webfont files with a cache-first strategy for 1 year
workbox.routing.registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new workbox.strategies.CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        maxEntries: 30,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Cache CSS, JS, and Web Worker files with a stale-while-revalidate strategy
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "static-resources",
  }),
);

// Cache images with a cache-first strategy (30 days TTL)
workbox.routing.registerRoute(
  ({ request }) => request.destination === "image",
  new workbox.strategies.CacheFirst({
    cacheName: "images",
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Cache screen content API with network-first strategy (24h TTL)
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/api/screen/content"),
  new workbox.strategies.NetworkFirst({
    cacheName: "api-content",
    networkTimeoutSeconds: 10, // Fallback to cache if network request takes more than 10 seconds
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Cache prayer times API with stale-while-revalidate strategy (7 days TTL)
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/api/screen/prayer-times"),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "prayer-times",
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Cache events API with network-first strategy (24h TTL)
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/api/screen/events"),
  new workbox.strategies.NetworkFirst({
    cacheName: "events",
    networkTimeoutSeconds: 10,
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Cache other API responses with network-first strategy but fallback to cache if offline
workbox.routing.registerRoute(
  ({ url }) =>
    url.pathname.includes("/api/") &&
    !url.pathname.startsWith("/api/screen/content") &&
    !url.pathname.startsWith("/api/screen/prayer-times") &&
    !url.pathname.startsWith("/api/screen/events"),
  new workbox.strategies.NetworkFirst({
    cacheName: "api-responses",
    networkTimeoutSeconds: 10, // Fallback to cache if network request takes more than 10 seconds
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 12 * 60 * 60, // 12 hours
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Handle messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CACHE_CRITICAL_ASSETS") {
    // Cache critical assets for offline use
    const criticalUrls = [
      "/",
      "/index.html",
      "/static/css/main.css",
      "/static/js/main.js",
      "/manifest.json",
      "/logo192.png",
      "/logo512.png",
      "/favicon.ico",
    ];

    const cacheName = "critical-assets";
    const preCache = async () => {
      const cache = await caches.open(cacheName);
      return cache.addAll(criticalUrls);
    };

    event.waitUntil(preCache());
  }
});

// When the service worker is activated, clean up old caches
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [
    "google-fonts-stylesheets",
    "google-fonts-webfonts",
    "static-resources",
    "images",
    "api-content",
    "prayer-times",
    "events",
    "api-responses",
    "critical-assets",
    "workbox-precache",
  ];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log("Deleting out of date cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );

  self.clients.claim();
});

// Special handling for navigation requests - serve index.html for all navigation requests
// This ensures that the SPA works properly when offline or when using client-side routing
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  async () => {
    try {
      // Try network first
      return await workbox.strategies
        .NetworkFirst({
          cacheName: "navigations",
          plugins: [
            new workbox.expiration.ExpirationPlugin({
              maxEntries: 1,
              maxAgeSeconds: 24 * 60 * 60, // 24 hours
            }),
          ],
        })
        .handle({ request: new Request("index.html") });
    } catch (error) {
      // If network fails, fallback to cache
      const cache = await caches.open("navigations");
      const cachedResponse = await cache.match("index.html");
      return cachedResponse || Response.error();
    }
  },
);
