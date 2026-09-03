"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sends the browser somewhere else after a beat.
 *
 * `replace`, not `push`: the check-in screen must not end up in the back
 * stack, or a member tapping back re-runs the scan and stares at a
 * confirmation for a visit they already have.
 */
export function AutoReturn({ to, afterMs }: { to: string; afterMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace(to), afterMs);
    return () => clearTimeout(timer);
  }, [router, to, afterMs]);

  return null;
}
