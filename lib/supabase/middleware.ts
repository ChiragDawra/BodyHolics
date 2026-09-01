import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { isAdminEmail } from "@/lib/config";

/**
 * Refreshes the Supabase auth session and routes people to the right half of
 * the app.
 *
 * Do not add logic between `createServerClient` and `getUser()` — anything
 * that runs in between can leave a user randomly signed out.
 *
 * Routing by email here is a convenience so the owner lands on /admin instead
 * of the member app. It is not the authorisation boundary: the admin layout
 * re-checks `is_staff()` server-side, and RLS enforces it at the database.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdmin = isAdminEmail(user?.email);

  // Members: no session means they have not joined yet.
  if (pathname.startsWith("/app") && !user) {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // The owner has no use for the member app; send them to the dashboard.
  // /app/complete-profile is exempt — an admin signing in for the first time
  // still has to give the desk a phone number like anyone else.
  if (
    user &&
    isAdmin &&
    pathname.startsWith("/app") &&
    !pathname.startsWith("/app/complete-profile")
  ) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return supabaseResponse;
}
