import { strings } from "@/lib/strings";

/**
 * Member PWA manifest, served at /manifest.webmanifest.
 *
 * This is a route handler rather than the `app/manifest.ts` file convention
 * because the owner's /check app needs a second, different manifest. The file
 * convention injects one <link rel="manifest"> into every page in the app,
 * which would fight with the check one. Each route group links its own.
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
      background_color: "#141413",
      theme_color: "#141413",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
