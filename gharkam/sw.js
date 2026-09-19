// =========================================================
// Gharmitra Progressive Web App (PWA) Service Worker
// Cache Version: gharmitra-pwa-v1
// =========================================================

const CACHE_NAME = 'gharmitra-pwa-v1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './customer.html',
    './worker.html',
    './admin.html',
    './css/common.css',
    './css/index.css',
    './css/customer.css',
    './css/worker.css',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-192x192-maskable.png',
    './icons/icon-512x512.png',
    './icons/icon-512x512-maskable.png',
    './icons/favicon.png',
    './js/pwa.js',
    './js/firebase.js'
];

// --- 1. Install Event (Pre-cache core app shell) ---
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[PWA SW] Pre-caching non-fatal warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// --- 2. Activate Event (Clean up outdated caches) ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[PWA SW] Removing old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// --- 3. Fetch Event (Network-First Strategy with Cache Fallback) ---
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Skip non-GET requests and Firebase Realtime Database WebSockets/Long-polling
    if (req.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
        return;
    }

    // Pass through Firebase, Razorpay, or external dynamic API calls
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('razorpay.com') ||
        url.hostname.includes('emailjs.com')) {
        return;
    }

    // Network-First with Cache Fallback for App Pages and Assets
    event.respondWith(
        fetch(req)
            .then((networkResponse) => {
                // Cache valid response clones
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If offline or fetch failed, fallback to cache
                return caches.match(req).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If navigation request fails, return cached index.html
                    if (req.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Network unavailable', { status: 503, statusText: 'Offline' });
                });
            })
    );
});
