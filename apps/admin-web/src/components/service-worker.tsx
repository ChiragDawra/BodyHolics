'use client';

import { useEffect } from 'react';

/**
 * Registers `/public/sw.js`, which is what makes the console installable.
 *
 * Development is excluded on purpose. A worker that survives a rebuild serves
 * the previous build's hashed chunks against the new HTML, and the result is a
 * blank page with a chunk-load error that looks like a code bug. Registering
 * only in production keeps that failure out of the loop entirely.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // A registration that fails is a console without offline support, not a
    // broken console — so it is swallowed rather than surfaced to the owner.
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);

  return null;
}
