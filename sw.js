// Service Worker for Agent Follow-up CRM
// Version: 2.2.5-ref - ICP Score table simplified - removed Expected/Example Answer and Verification Source columns

const CACHE_NAME = 'agent-follow-up-crm-v2.2.7-network-first';
const VERSION = '2.2.7-network-first';

// Install event - only cache static assets that don't affect layout (don't cache HTML/JS so users always get fresh UI)
self.addEventListener('install', event => {
  console.log('🔄 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Service Worker: Cache opened');
        return cache.addAll([
          '/manifest.json',
          '/version.json'
        ]);
      })
      .then(() => {
        console.log('✅ Service Worker: Essential resources cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: Activating with cache cleanup...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activated successfully - all old caches cleared');
        // Force refresh all clients to get the new version
        return Promise.all([
          self.clients.claim(),
          // Send message to all clients to refresh
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'FORCE_REFRESH', reason: 'Clickable ICP Score with detailed modal - click ICP score in table or mobile card to view/edit scoring with lead details banner' });
            });
          })
        ]);
      })
      .catch(error => {
        console.error('❌ Service Worker: Activation failed:', error);
      })
  );
});

// Fetch event - handle caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NEVER intercept API requests - let them go to the backend (avoids wrong port / cache errors)
  if (url.pathname.startsWith('/api/') || event.request.url.includes('/api/')) {
    return;
  }

  // NEVER intercept authentication-related requests - let them pass through directly
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('accounts.google.com') ||
      url.hostname.includes('google.com') ||
      url.pathname.includes('/auth/') ||
      url.pathname.includes('/oauth/') ||
      url.pathname.includes('/v1/accounts:') ||
      url.pathname.includes('/v1/projects') ||
      url.searchParams.has('auth') ||
      url.searchParams.has('token') ||
      url.searchParams.has('oauth') ||
      url.searchParams.has('key')) {
    console.log('🚫 Service Worker: Bypassing auth request:', url.hostname + url.pathname);
    // Don't intercept at all - let the browser handle these requests directly
    return;
  }

  // Skip non-GET requests for other requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Always fetch version.json fresh to check for updates
  if (event.request.url.includes('/version.json')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Always fetch document (HTML) and app scripts/styles from network first so layout is never stale
  const isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isAppResource = event.request.destination === 'script' || event.request.destination === 'style' || event.request.url.includes('.js') || event.request.url.includes('.css');

  if (isDocument || url.pathname === '/' || url.pathname === '/index.html' || isAppResource) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic' && !isDocument && !url.pathname.endsWith('.html')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document' || isDocument) {
            return caches.match('/index.html').then(r => r || caches.match('/'));
          }
          return caches.match(event.request);
        })
    );
    return;
  }

  // For other requests (icons, manifest, etc.), use cache-first for offline support
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') return response;
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache)).catch(() => {});
            return response;
          })
          .catch(() => caches.match(event.request));
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    console.log('🔄 Service Worker: Checking for updates...');
    
    fetch('/version.json', { cache: 'no-cache' })
      .then(response => response.json())
      .then(data => {
        if (data.version !== VERSION) {
          console.log('🔄 Service Worker: Update available:', data.version);
          event.ports[0].postMessage({ updateAvailable: true, newVersion: data.version });
        } else {
          console.log('✅ Service Worker: No updates available');
          event.ports[0].postMessage({ updateAvailable: false });
        }
      })
      .catch(error => {
        console.warn('⚠️ Service Worker: Failed to check for updates:', error);
        event.ports[0].postMessage({ updateAvailable: false });
      });
  }
});

// Handle notification clicks for PWA notifications
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  console.log('📋 Notification data:', event.notification.data);
  
  const data = event.notification.data || {};
  const notificationId = data.notificationId || event.notification.tag;
  const leadId = data.leadId;
  const meetingId = data.meetingId || data.followUpId; // Support both meetingId and followUpId
  const followUpId = data.followUpId || data.meetingId; // Support both followUpId and meetingId
  const category = data.category || 'meeting_reminders'; // Default category

  // Handle snooze action
  if (event.action === 'snooze') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NOTIFICATION_SNOOZE',
            notificationId,
            minutes: 15,
            leadId,
            meetingId: followUpId || meetingId,
            followUpId
          });
        });
      })
    );
    event.notification.close();
    return;
  }

  // Handle view action or default click
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If app is open, focus it and navigate to the follow-up
        if (clientList.length > 0) {
          const client = clientList[0];
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            notificationId,
            leadId,
            meetingId: followUpId || meetingId,
            followUpId: followUpId || meetingId, // Ensure followUpId is always set
            action: 'view'
          });
        } else if (self.clients.openWindow) {
          // If app is not open, open it
          self.clients.openWindow('/').then((windowClient) => {
            if (windowClient) {
              // Wait a bit for the app to load before sending message
              setTimeout(() => {
                windowClient.postMessage({
                  type: 'NOTIFICATION_CLICK',
                  notificationId,
                  leadId,
                  meetingId: followUpId || meetingId,
                  followUpId: followUpId || meetingId, // Ensure followUpId is always set
                  action: 'view'
                });
              }, 1000);
            }
          }).catch((error) => {
            console.error('Error opening window:', error);
          });
        }
      })
    );
    event.notification.close();
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('🔔 Notification closed:', event.notification.tag);
  const data = event.notification.data || {};
  const notificationId = data.notificationId || event.notification.tag;

  // Notify clients that notification was closed
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'NOTIFICATION_CLOSED',
          notificationId
        });
      });
    })
  );
});

console.log('✅ Service Worker: Loaded successfully');