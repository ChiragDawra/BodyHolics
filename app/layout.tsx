import type { Metadata } from "next";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import "./globals.css";

export const metadata: Metadata = {
  title: strings.app.name,
  description: strings.app.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
