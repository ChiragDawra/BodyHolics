import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the icons, and the service worker.
     * sw.js in particular must never be rewritten or redirected, or the
     * browser refuses to register it.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
