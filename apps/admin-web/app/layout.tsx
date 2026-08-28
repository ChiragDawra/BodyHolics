import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { ServiceWorkerRegistrar } from '@/components/service-worker';

export const metadata: Metadata = {
  title: 'Urban Gym — Admin',
  description: 'Membership, payments, and floor operations for Urban Gym.',
  robots: { index: false, follow: false },
  // iOS ignores the manifest's icons and reads this instead, so an install
  // without it gets a screenshot of the page as its home-screen icon.
  appleWebApp: {
    capable: true,
    title: 'Gym Admin',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/icons/favicon.png', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // An installed console is a tool, not a document: a double-tap that zooms the
  // members table is a misfire every time.
  maximumScale: 1,
  // Keeps content clear of the notch and the home indicator once the browser
  // chrome is gone.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0d11' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
