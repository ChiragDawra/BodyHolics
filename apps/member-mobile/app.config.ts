import type { ExpoConfig } from 'expo/config';

/**
 * D-006 — a member joins by scanning the gym's QR code, which encodes a deep
 * link carrying the gym slug. The scheme and the linked domain below are what
 * make that land in the app rather than a browser.
 */
const config: ExpoConfig = {
  name: 'Urban Gym',
  slug: 'urban-gym-member',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'urbangym',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'in.urbangym.member',
    infoPlist: {
      // expo-camera needs a purpose string, and it has to say what it is for in
      // the member's terms — this is what they see on the permission prompt.
      NSCameraUsageDescription:
        'Urban Gym uses the camera to scan the gym QR code when you join.',
    },
  },
  android: {
    package: 'in.urbangym.member',
    adaptiveIcon: { backgroundColor: '#0A0D11' },
    permissions: ['CAMERA'],
  },
  /**
   * The member app also ships as an installable web app, so a member can join
   * from a link before either store listing exists.
   *
   * `single` — one `index.html`, routed on the client — rather than `static`.
   * Static rendering runs every route in Node at export time, and this app signs
   * in before it renders: the Supabase client reads a stored session, which
   * touches `window`, and the export dies with `ReferenceError: window is not
   * defined`. That is not a bug to fix, it is what an auth-gated SPA is. Nothing
   * here benefits from prerendered HTML anyway — every screen is behind a login.
   *
   * The consequence is that `app/+html.tsx` does not apply (Expo only uses it
   * when static rendering), so the PWA head tags are injected into the exported
   * `index.html` by `scripts/finish-web-export.mjs`, which `build:web` runs.
   */
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './public/icons/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-camera', { cameraPermission: 'Scan the gym QR code to join.' }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Read through expo-constants rather than process.env at runtime, so a
    // missing value fails at startup with a clear message instead of producing
    // an undefined URL somewhere deep in a fetch.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'local',
  },
};

export default config;
