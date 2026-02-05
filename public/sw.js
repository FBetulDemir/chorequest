const CACHE_NAME = 'chorequest-v2';

// Only cache truly static assets - NOT pages that require auth
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      // Use addAll with catch to handle failures gracefully
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('Service Worker: Failed to cache some assets', err);
      });
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('chorequest-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('Service Worker: Clearing old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - network first, with cache fallback for static assets only
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (like Firebase)
  if (!request.url.startsWith(self.location.origin)) return;

  // For navigation requests (pages), always go to network
  // This prevents caching issues with authenticated pages
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // Only show offline fallback if network completely fails
        return new Response(
          '<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>You are offline</h1><p>Please check your internet connection.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // For other requests (JS, CSS, images), use network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses for static assets
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
