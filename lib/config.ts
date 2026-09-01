/**
 * This build serves exactly one gym. Its slug is the only place that
 * assumption is written down, so a multi-gym version replaces reads of this
 * constant with a route parameter and nothing else changes.
 */
export const GYM_SLUG = "bodyholics";

/**
 * Who gets routed to /admin after Google sign-in.
 *
 * This is a demo convenience, NOT the authorisation boundary. The `staff`
 * table and `is_staff()` are what RLS actually enforces, and every admin read
 * and write goes through them. A user whose email matched but who is not on
 * the staff table would reach /admin and see nothing but empty results.
 *
 * Compared case-insensitively because Google returns the address as the user
 * typed it at sign-up.
 */
export const ADMIN_EMAILS = ["chiragdawra46@gmail.com"] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalised = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((allowed) => allowed === normalised);
}

/** Where a signed-in user belongs, given their email. */
export function homeFor(email: string | null | undefined): "/admin" | "/app" {
  return isAdminEmail(email) ? "/admin" : "/app";
}
