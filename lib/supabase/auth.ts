import { createClient } from "./server";

/**
 * The signed-in user, or null.
 *
 * Always `getUser()`, never `getSession()`, on the server: getSession reads the
 * cookie without verifying it, so it can be forged. getUser revalidates the
 * token with Supabase.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/** Whether the signed-in user is on the staff table for any gym. */
export async function isStaff(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_staff_anywhere");
  if (error) return false;
  return data === true;
}
