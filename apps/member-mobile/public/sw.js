/* eslint-env serviceworker */

/**
 * Service worker for the member web app.
 *
 * The Expo export is a single-page app: one `index.html` plus hashed bundles
 * under `/_expo/static/`. None of that is specific to a member, so the shell can
 * be cached and the app opens instantly — and still opens on the gym's Wi-Fi
 * dead spot, where it shows its own "no connection" state rather than the
 * browser's.
 *
 * WHAT IT DELIBERATELY DOES NOT CACHE
 *
 * Every response from Supabase — the session, the membership, attendance, the
 * counter QR token. Two of those are actively dangerous to serve from disk: a
 * cached token refresh signs the member out for no visible reason, and a cached
 * counter QR is a payment authorization that has already been spent. The token
 * has a 120s TTL precisely so it cannot be reused, and a cache would hand that
 * property back.
 *
 * So the rule is: static shell yes, anything cross-origin never.
 */

const VERSION = 'v1';
const CACHE = `gym-member-${VERSION}`;
const SHELL_URL = '/';
const OFFLINE_URL = '/offline.html';

const PRECACHE = [SHELL_URL, OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Hashed bundle output and brand icons: same bytes for the life of the build. */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase and Razorpay both live on other origins. Untouched, always.
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

  // The shell. Network first so a fresh deploy wins the moment the member is
  // online — a cached `index.html` that outlives its bundle hashes is a white
  // screen, which is the worst failure this file could cause.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(SHELL_URL, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(SHELL_URL)
            .then((hit) => hit ?? caches.match(OFFLINE_URL))
            .then(
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
});
