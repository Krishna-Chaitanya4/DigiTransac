// Service Worker for DigiTransac PWA
const CACHE_VERSION = '1.4.2';
const CACHE_NAME = `digitransac-v${CACHE_VERSION}`;
const API_CACHE = `digitransac-api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `digitransac-images-v${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error('[ServiceWorker] Failed to cache static assets:', error);
      });
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old caches
            return name.startsWith('digitransac-') && 
                   name !== CACHE_NAME && 
                   name !== API_CACHE && 
                   name !== IMAGE_CACHE;
          })
          .map((name) => {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (except for fonts and images)
  if (url.origin !== location.origin && !request.url.match(/\.(jpg|jpeg|png|gif|svg|woff|woff2|ttf)$/i)) {
    return;
  }

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Images - cache first, then network
  if (request.destination === 'image' || request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Fonts and static assets - cache first
  if (request.url.match(/\.(woff|woff2|ttf|eot)$/i) || request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
    return;
  }

  // Navigation requests - network first with faster timeout
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithTimeout(request, 3000));
    return;
  }

  // Static assets - cache first, then network
  event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
});

// Network first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    // Cache successful GET requests
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If network fails, try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log('[ServiceWorker] Serving from cache (offline):', request.url);
      return cached;
    }
    // Return offline response for API calls
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'No network connection. Please check your internet connection and try again.',
        offline: true 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Cache first strategy (for static assets and images)
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in the background
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, response);
        });
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return a fallback response
    return new Response('Offline', { status: 503 });
  }
}

// Network first with timeout (for navigation)
async function networkFirstWithTimeout(request, timeout) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If network fails or times out, try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return cached index.html for navigation
    return caches.match('/index.html');
  }
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  console.log('[ServiceWorker] Syncing offline transactions...');
  // This would be handled by the app's sync manager
  // Notify all clients that sync is needed
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  });
}

console.log('[ServiceWorker] Loaded successfully');

// Message event - handle commands from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  }
});

// Background sync event - sync offline changes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(
      // Notify clients to start sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC',
            action: 'START_SYNC',
          });
        });
      })
    );
  }
});
