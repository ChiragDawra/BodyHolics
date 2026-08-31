import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { MemberTabBar } from "@/components/member/MemberTabBar";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.app.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: strings.app.shortName,
    // Translucent lets the app paint under the status bar; combined with
    // viewport-fit=cover and the safe-area padding below, the header sits
    // clear of the notch instead of behind it.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <ServiceWorkerRegistrar />
      {/* Bottom padding clears the fixed tab bar plus the iOS home indicator. */}
      <div className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <MemberTabBar />
    </div>
  );
}
