// Kill switch service worker. One-shot: any client that fetches /sw.js gets
// a SW that immediately wipes every cache, unregisters itself, and force-
// navigates open clients to /. After this runs once per stuck browser,
// nothing intercepts fetches and the site is served fresh from network.
//
// This file lives in public/ and replaces the workbox-generated sw.js for a
// single deploy. After the stuck-Chrome cohort has been swept, restore the
// VitePWA plugin in vite.config.ts to put the real precaching SW back.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // ignore
    }
    try {
      await self.registration.unregister();
    } catch {
      // ignore
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        clients.map(async (client) => {
          try {
            await client.navigate('/');
          } catch {
            try {
              client.postMessage({ type: 'sw-kill-reload' });
            } catch {
              // ignore
            }
          }
        }),
      );
    } catch {
      // ignore
    }
  })());
});

// Don't intercept anything while alive. Every request passes through to the
// network so the user always sees the freshest deploy.
self.addEventListener('fetch', () => {
  // intentionally no-op
});
