import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteProfileForm } from "@/components/member/CompleteProfileForm";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.join.detailsTitle };
export const dynamic = "force-dynamic";

/**
 * Step 2 of 3.
 *
 * Lives under /app rather than /join because it needs a session — the member
 * has already signed in with Google by the time they arrive. Middleware lets
 * this one path through for admins too: the owner also has to give the desk a
 * number before the dashboard is any use.
 */
export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, emergency_contact")
    .eq("id", user.id)
    .maybeSingle();

  // Already done — nothing to complete.
  if (profile?.phone) redirect("/join/done");

  return (
    <CompleteProfileForm
      initialName={profile?.full_name ?? ""}
      email={profile?.email ?? user.email ?? ""}
    />
  );
}
