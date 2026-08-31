import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Inter } from "next/font/google";
import { strings } from "@/lib/strings";
import "./globals.css";

/**
 * DM Sans carries headings and numbers; Inter carries reading text. Loaded
 * through next/font so they are self-hosted and preloaded rather than costing
 * a blocking round trip to Google on a patchy 4G connection.
 *
 * The CSS variables these expose are what --font-display and --font-body in
 * globals.css point at. Font names still live only in the token file.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: strings.app.name,
    template: `%s · ${strings.app.name}`,
  },
  description: strings.app.description,
  applicationName: strings.app.name,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The member and check apps paint to the very edge of the screen; without
  // this the safe-area env() values are all zero.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
