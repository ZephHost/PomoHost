const CACHE_NAME = 'pwa-cache-v12';
const DYNAMIC_CACHE = 'pwa-dynamic-v1';


const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/layerscript.js',
  '/apple-touch-icon.png',
  '/icon-512.png',
  '/loading.webp',
  '/favicon.ico',
  '/offline.html'
];

// Install event - cache core resources
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Core files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error during install:', error);
      })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      // This will execute only after all the above promises resolve
      console.log('[SW] Activation complete, sending GO message');
      sendgo();
    })
  );
});

// Fetch event with improved caching strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for non-GET requests (fixes the POST error)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  
  // Skip caching for specific file types or paths
  if (shouldSkipCaching(request.url)) {
    event.respondWith(fetch(request));
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {


        if (cachedResponse) {
          console.log('[SW] Serving from cache:', request.url);
          return cachedResponse;
        }
        
        console.log('[SW] Fetching from network:', request.url);
        return fetch(request)
          .then(networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || 
                networkResponse.status !== 200 || 
                networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }
            
            // Clone the response (stream can only be consumed once)
            const responseToCache = networkResponse.clone();
            
            // Cache the response for future use
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                console.log('[SW] Caching new resource:', request.url);
                cache.put(request, responseToCache);
              })
              .catch(error => {
                console.error('[SW] Error caching resource:', error);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Network fetch failed:', error);
            
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match(OFFLINE_PAGE);
            }
            
            // For other requests, you might want to return a fallback
            throw error;
          });
      })
  );
});

// Helper function to determine if a request should be cached
function shouldSkipCaching(url) {
  const skipPatterns = [
    '/api/',           // Skip API calls
    '/admin/',         // Skip admin pages
    '.php',           // Skip PHP files
    'chrome-extension:', // Skip extension requests
    'analytics',      // Skip analytics
    'gtag',          // Skip Google Analytics
  ];
  
  return skipPatterns.some(pattern => url.includes(pattern));
}



// Message handling for communication with main thread
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});


function sendgo(){
self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'GO' });
        });
      });}
