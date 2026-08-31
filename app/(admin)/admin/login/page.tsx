import { redirect } from "next/navigation";
import { getUser, isStaff } from "@/lib/supabase/auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Card, CardBody } from "@/components/ui/Card";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.signInTitle };

/**
 * Staff sign-in.
 *
 * Being signed in is not the same as being staff: a member who reaches this
 * page with a valid session is told plainly that their account is not on the
 * staff list, rather than bounced in a redirect loop.
 */
export default async function AdminLoginPage() {
  const user = await getUser();

  if (user && (await isStaff())) redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-sunken px-5">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-5 pt-6">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-ink">
              {user ? strings.admin.notStaffTitle : strings.admin.signInTitle}
            </h1>
            <p className="text-sm text-ink-muted">
              {user ? strings.admin.notStaffBody : strings.admin.signInBody}
            </p>
          </div>

          {user ? (
            <SignOutButton label={strings.admin.signOut} />
          ) : (
            <GoogleSignInButton
              label={strings.admin.signInWithGoogle}
              next="/admin"
            />
          )}
        </CardBody>
      </Card>
    </main>
  );
}
