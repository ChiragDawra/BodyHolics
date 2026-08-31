"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

/**
 * Starts the Supabase Google OAuth flow.
 *
 * `next` is where the callback route sends the browser once the session
 * cookies are written.
 */
export function GoogleSignInButton({
  label,
  next = "/app",
  onError,
}: {
  label: string;
  next?: string;
  onError?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const supabase = createClient();

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });

    if (error) {
      setBusy(false);
      onError?.();
    }
  };

  return (
    <Button
      size="lg"
      fullWidth
      variant="secondary"
      disabled={busy}
      onClick={() => void signIn()}
    >
      <GoogleIcon className="h-5 w-5" />
      {label}
    </Button>
  );
}
