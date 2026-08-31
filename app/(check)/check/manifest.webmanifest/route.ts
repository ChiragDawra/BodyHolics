import { strings } from "@/lib/strings";
import { PWA_BACKGROUND } from "@/lib/theme";

/**
 * Owner quick-check PWA manifest, served at /check/manifest.webmanifest.
 *
 * Separate scope and start_url from the member manifest so the owner can
 * install both on the same phone and get two distinct home screen icons that
 * open two distinct apps.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: `${strings.app.name} ${strings.check.title}`,
      short_name: strings.app.staffShortName,
      description: "Crowd, hours, and check-ins for the desk.",
      start_url: "/check",
      scope: "/check",
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
