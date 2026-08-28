import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript source rather than build output, so
  // Next has to compile them itself.
  transpilePackages: ['@gym/domain', '@gym/types', '@gym/ui', '@gym/validation'],
  typedRoutes: true,
  poweredByHeader: false,
  // Next's type requires a promise here, so the async is part of the contract
  // rather than an oversight.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    return [
      {
        // A service worker cached by the browser pins the app to the build that
        // installed it: the next deploy ships, and the worker that decides what
        // to serve is still the old one. `no-cache` makes the browser
        // revalidate, which is what lets a fix actually reach an installed PWA.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;
