import { strings } from "@/lib/strings";
import { PWA_BACKGROUND } from "@/lib/theme";

/**
 * Member PWA manifest, served at /manifest.webmanifest.
 *
 * A route handler rather than the `app/manifest.ts` file convention: that
 * convention injects one <link rel="manifest"> into every page in the app,
 * including the public landing page and the admin dashboard, neither of which
 * is installable. The member route group links this one itself.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: strings.app.name,
      short_name: strings.app.shortName,
      description: strings.app.description,
      start_url: "/app",
      scope: "/app",
      display: "standalone",
      orientation: "portrait",
      background_color: PWA_BACKGROUND,
      theme_color: PWA_BACKGROUND,
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
