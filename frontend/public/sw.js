// Service worker: shows web push alerts and opens the right page when one is
// tapped. No offline caching: prices must never be shown from an old copy.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Only pages on this site may be opened, whatever the payload says.
function sameOriginUrl(url) {
  try {
    const target = new URL(url || "/", self.location.origin);

    return target.origin === self.location.origin ? target.href : self.location.origin + "/";
  } catch {
    return self.location.origin + "/";
  }
}

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Crypto Tracker";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/pwa-icon/192",
        badge: "/pwa-icon/192",
        // A newer alert of the same kind replaces the old one instead of stacking.
        tag: data.tag || undefined,
        data: { url: sameOriginUrl(data.url) },
      });

      // Open tabs refresh their alert history.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((client) => client.postMessage({ type: "push-received" }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = sameOriginUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Reuse an open tab rather than stacking new ones.
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();

          if ("navigate" in client) return client.navigate(url);

          return undefined;
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});
