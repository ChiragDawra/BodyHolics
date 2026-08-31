import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.check.title,
  // Its own manifest, so installing this does not collide with the member app.
  manifest: "/check/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: strings.app.staffShortName,
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function CheckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-surface">
      <ServiceWorkerRegistrar />
      {children}
    </div>
  );
}
