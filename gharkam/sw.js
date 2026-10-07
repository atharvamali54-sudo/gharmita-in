// =========================================================
// Gharmitra Progressive Web App (PWA) Service Worker
// Cache Version: gharmitra-pwa-v1
// =========================================================

const CACHE_NAME = 'gharmitra-pwa-v62';

const STATIC_ASSETS = [
    './',
    './index.html',
    './customer.html',
    './worker.html',
    './admin.html',
    './about.html',
    './contact.html',
    './terms.html',
    './privacy.html',
    './refund.html',
    './shipping-policy.html',
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
    './js/firebase.js',
    './js/call-masking.js'
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

// =========================================================
// 4. Background Push Event (Web Push API - Works when app is closed)
// =========================================================
self.addEventListener('push', (event) => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = { title: 'घरमित्र (Gharmitra) अपडेट', body: event.data.text() };
        }
    }

    const title = payload.title || 'घरमित्र (Gharmitra) अलर्ट 🔔';
    const body = payload.body || 'नवीन ऑर्डर किंवा महत्त्वाचे अपडेट उपलब्ध आहे.';
    const targetUrl = payload.url || payload.click_action || './index.html';
    const tag = payload.tag || ('gharmitra-' + Date.now());

    const options = {
        body: body,
        icon: payload.icon || './icons/icon-192x192.png',
        badge: payload.badge || './icons/favicon.png',
        vibrate: payload.vibrate || [300, 150, 300, 150, 400],
        tag: tag,
        renotify: true,
        requireInteraction: true,
        silent: false, // Triggers native mobile OS system notification sound
        data: {
            url: targetUrl,
            orderId: payload.orderId || null,
            timestamp: Date.now()
        },
        actions: [
            { action: 'open_app', title: '📲 ॲप उघडा' },
            { action: 'dismiss', title: '✕ बंद करा' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// =========================================================
// 5. Notification Click Event (User taps notification on lock screen)
// =========================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : './index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already an open window matching the target
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not open, launch the window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// =========================================================
// 6. Direct Client Message Dispatch (Show Notification via Service Worker)
// =========================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const title = event.data.title || 'घरमित्र (Gharmitra) अपडेट';
        const options = Object.assign({
            icon: './icons/icon-192x192.png',
            badge: './icons/favicon.png',
            vibrate: [250, 100, 250, 100, 300],
            requireInteraction: true,
            renotify: true,
            silent: false // Triggers native mobile OS system notification sound
        }, event.data.options || {});

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

