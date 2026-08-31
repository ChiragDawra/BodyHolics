import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase auth session and gates the protected route groups.
 *
 * Do not add logic between `createServerClient` and `getUser()` — anything that
 * runs in between can leave a user randomly signed out.
 *
 * `/check/*` is deliberately absent: it has no session at all and is gated by
 * the PIN pad plus PIN-verifying RPCs instead.
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

  // Members: no session means they have not joined yet.
  if (pathname.startsWith("/app") && !user) {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  // Staff: the session check happens here, but being staff is verified again
  // server-side on the page itself. Middleware alone is not the authorisation
  // boundary — RLS is.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return supabaseResponse;
}
