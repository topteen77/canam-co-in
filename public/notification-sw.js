// Notification Service Worker for PWA
// Handles scheduled meeting notifications

self.addEventListener('install', (event) => {
  console.log('✅ Notification Service Worker: Installing...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('✅ Notification Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  
  const data = event.notification.data || {};
  const notificationId = data.notificationId || event.notification.tag;
  const leadId = data.leadId;
  const meetingId = data.meetingId;

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
            meetingId
          });
        });
      })
    );
    event.notification.close();
    return;
  }

  // Handle view action
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If app is open, focus it and navigate to the meeting
        if (clientList.length > 0) {
          const client = clientList[0];
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            notificationId,
            leadId,
            meetingId,
            action: 'view'
          });
        } else if (self.clients.openWindow) {
          // If app is not open, open it
          self.clients.openWindow('/').then((windowClient) => {
            if (windowClient) {
              windowClient.postMessage({
                type: 'NOTIFICATION_CLICK',
                notificationId,
                leadId,
                meetingId,
                action: 'view'
              });
            }
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

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('📨 Notification Service Worker: Message received:', event.data.type);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { notificationId, title, body, scheduledTime, meetingTime, leadId, meetingId } = event.data;
    
    // Schedule notification (note: we can't schedule exact time, but we can store it)
    // The main thread will handle the timing
    console.log('📅 Notification scheduled:', notificationId, 'for', new Date(scheduledTime).toLocaleString());
  }
  
  if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
    const { notificationId } = event.data;
    console.log('❌ Notification cancelled:', notificationId);
  }
});

console.log('✅ Notification Service Worker: Loaded successfully');




