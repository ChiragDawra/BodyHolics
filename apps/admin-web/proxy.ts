import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Runs before every matched request (Next 16 calls this file `proxy`; it is the
 * successor to `middleware.ts` referenced in docs/06 §1).
 *
 * Two jobs, and only two:
 *   1. refresh the Supabase session so Server Components see a live user;
 *   2. bounce an unauthenticated request away from the dashboard.
 *
 * It deliberately does **not** decide whether the user is staff. That is a
 * question about `gym_staff`, and answering it here would put an authorization
 * decision in a layer docs/04 §5 calls cosmetic. Staff-ness is enforced by RLS
 * on every query and re-checked in the dashboard layout.
 */

/** docs/04 §4: admin sessions are shorter than member sessions. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_SEEN_COOKIE = 'admin_last_seen';

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
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
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser revalidates the token with the auth server. getSession only decodes
  // the cookie, which a client can write, so it must never gate a redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login');

  if (!user) {
    if (isAuthRoute) return response;
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    // Preserve where they were going, but only as a path — an absolute URL here
    // would turn the login page into an open redirect.
    redirect.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(redirect);
  }

  const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value ?? 0);
  const now = Date.now();

  if (lastSeen > 0 && now - lastSeen > IDLE_TIMEOUT_MS) {
    await supabase.auth.signOut();
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.search = '?reason=idle';
    const signedOut = NextResponse.redirect(redirect);
    signedOut.cookies.delete(LAST_SEEN_COOKIE);
    return signedOut;
  }

  if (isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  response.cookies.set(LAST_SEEN_COOKIE, String(now), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: IDLE_TIMEOUT_MS / 1000,
  });

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
