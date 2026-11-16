// HostelMS service worker — makes the app installable and lets the app shell
// open with a weak or no connection (so a student can still show the QR they
// last opened). API calls are NEVER cached here: they go to the backend's own
// origin, which this worker does not intercept, and personal data must not
// sit in a shared cache.
const VERSION = 'hostelms-v2';
const SHELL = ['/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

// Each portal (/student, /staff, /gate) is its own app with its own page.
const PORTALS = ['student', 'staff', 'gate'];
const shellFor = (pathname) => {
  const seg = pathname.split('/')[1];
  return PORTALS.includes(seg) ? `/${seg}/index.html` : '/index.html';
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/developer')) return;

  // Pages: try the network, fall back to the cached app shell when offline.
  if (request.mode === 'navigate') {
    const shell = shellFor(url.pathname);
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(VERSION).then((c) => c.put(shell, copy));
          return res;
        })
        .catch(() => caches.match(shell))
    );
    return;
  }

  // Built assets have content hashes in their names, so cache-first is safe.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
      )
    );
  }
});
