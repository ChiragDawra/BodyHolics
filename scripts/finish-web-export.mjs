#!/usr/bin/env node
// Injects the PWA head tags into the member app's exported `index.html`.
//
// WHY THIS EXISTS
//
// The usual place for these is `app/+html.tsx`, and that file is ignored here:
// Expo only renders it when `web.output` is `static`. This app cannot use static
// output — it reads a stored Supabase session before it renders, which touches
// `window`, and the Node render fails with `ReferenceError: window is not
// defined`. See the comment in `apps/member-mobile/app.config.ts`.
//
// So the tags are injected after the export instead. Run automatically by
// `pnpm --filter member-mobile build:web`.
//
// It is idempotent: a marker comment means a second run over the same directory
// replaces the block rather than stacking a duplicate.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'apps/member-mobile/dist/index.html');

const START = '<!-- pwa:start -->';
const END = '<!-- pwa:end -->';

const BLOCK = `${START}
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0a0d11" />
    <meta name="application-name" content="Urban Gym" />
    <meta name="mobile-web-app-capable" content="yes" />

    <!-- iOS reads none of the manifest. Without these an install gets a
         screenshot for an icon and opens inside Safari's chrome. -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Urban Gym" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />

    <!-- Web has no native splash. Painting the app's own background on the
         document removes the white flash on a home-screen launch. -->
    <style>
      html, body, #root { background-color: #0a0d11; }
      body { overscroll-behavior-y: none; }
    </style>

    <!-- Registered on \`load\` rather than immediately: registering during
         startup competes with the bundle for the connection. -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
        });
      }
    </script>
    ${END}`;

if (!existsSync(INDEX)) {
  console.error(`No export found at ${INDEX}. Run \`expo export --platform web\` first.`);
  process.exit(1);
}

let html = readFileSync(INDEX, 'utf8');

if (html.includes(START)) {
  html = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), BLOCK);
} else {
  // Expo's template controls the viewport tag, and its default omits
  // `viewport-fit=cover` — without which the safe-area insets the app already
  // uses collapse to zero behind the notch once it is installed.
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover" />',
  );

  if (!html.includes('</head>')) {
    console.error('Exported index.html has no </head>; refusing to guess where the tags go.');
    process.exit(1);
  }

  html = html.replace('</head>', `  ${BLOCK}\n  </head>`);
}

writeFileSync(INDEX, html);
console.log('injected PWA head tags into apps/member-mobile/dist/index.html');
