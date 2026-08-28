import type { MetadataRoute } from 'next';

/**
 * Makes the admin console installable — "Add to Home Screen" on Android and iOS
 * — so the owner runs it from an icon rather than a browser tab.
 *
 * `display: standalone` is what removes the address bar. That is a real
 * trade-off on an authenticated console: without the bar there is no padlock and
 * no visible origin, so a member of staff cannot tell a real install from a
 * lookalike page. It is acceptable here because the icon is installed once, by
 * the owner, from a URL they were given — and the console is not linked from
 * anywhere a stranger would arrive.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Urban Gym — Admin',
    short_name: 'Gym Admin',
    description: 'Membership, payments, and floor operations for Urban Gym.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0d11',
    theme_color: '#0a0d11',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
