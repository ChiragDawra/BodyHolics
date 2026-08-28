/* eslint-env serviceworker */

/**
 * Service worker for the admin console.
 *
 * It exists for two reasons and no others: Chrome will not offer "Install" for a
 * site whose worker has no fetch handler, and the owner should get something
 * better than the browser's dinosaur when the gym's connection drops.
 *
 * WHAT IT DELIBERATELY DOES NOT CACHE
 *
 * Every page in this console renders member data — names, phone numbers,
 * payments. A cached page outlives the session that was allowed to see it, so on
 * a shared counter tablet the next person to open the app could be served the
 * previous person's screen straight from disk, signed out or not.
 *
 * So: navigations and data requests are network-only. The cache holds
 * build-immutable assets and one static offline page, none of which is specific
 * to any member or any session. If you are tempted to add a "stale-while-
 * revalidate for pages, it feels so much faster" rule here, that is the rule
 * this comment exists to stop.
 */

const VERSION = 'v1';
const CACHE = `gym-admin-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // A new worker that cannot precache is still better than the old one
      // sticking around, so a failed asset must not block activation.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Hashed build output and brand icons: same bytes for the life of the build. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Anything that changes state is none of this worker's business.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin means Supabase — auth, the Data API, Edge Functions. Never
  // touched: an intercepted token refresh that returns a stale response signs
  // the owner out for reasons nobody can debug.
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Pages: always the network. The cache is only ever a fallback for the case
  // where there is no network at all, and what it returns says exactly that
  // rather than pretending to be the page that was asked for.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (hit) =>
            hit ??
            new Response('You are offline.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
      ),
    );
  }

  // Everything else falls through to the browser untouched.
});
