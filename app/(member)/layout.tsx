import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.app.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: strings.app.shortName,
    // Translucent lets the app paint under the status bar; combined with
    // viewport-fit=cover and the safe-area padding in the header, the title
    // sits clear of the notch instead of behind it.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * Shell for /app/*. The tab bar is mounted per page rather than here, because
 * /app/complete-profile is inside this route group but must not show tabs —
 * a member who has not finished registering has nowhere to navigate to yet.
 */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <ServiceWorkerRegistrar />
      {children}
    </div>
  );
}
