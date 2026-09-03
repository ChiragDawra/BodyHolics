import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/config";

/**
 * Where Supabase sends the browser back after Google sign-in.
 *
 * Exchanges the one-time code for a session, writes the auth cookies, then
 * forwards to wherever the sign-in started from. `next` is validated as a
 * same-origin relative path so a crafted callback URL cannot use us as an open
 * redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/join?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/join?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

