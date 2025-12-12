// Koifit Service Worker
const CACHE_NAME = "koifit-v1";

// Timer state
let timerTimeout = null;

// Install event
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Listen for messages from the main app
self.addEventListener("message", (event) => {
  const { type, data } = event.data;

  if (type === "START_TIMER") {
    startTimer(data.seconds);
  } else if (type === "STOP_TIMER") {
    stopTimer();
  }
});

function startTimer(seconds) {
  // Clear any existing timer
  stopTimer();

  console.log(`[SW] Starting timer for ${seconds} seconds`);

  // Set timeout to show notification
  timerTimeout = setTimeout(() => {
    showTimerNotification();
  }, seconds * 1000);
}

function stopTimer() {
  if (timerTimeout) {
    clearTimeout(timerTimeout);
    timerTimeout = null;
    console.log("[SW] Timer stopped");
  }
}

function showTimerNotification() {
  console.log("[SW] Timer complete, showing notification");

  self.registration.showNotification("Rest Complete", {
    icon: "/assets/images/icon-192.png",
    badge: "/assets/images/icon-192.png",
    tag: "rest-timer",
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
  });
}

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Focus on the app window
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
