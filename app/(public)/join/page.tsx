import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { homeFor } from "@/lib/config";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.join.welcomeTitle };
export const dynamic = "force-dynamic";

/**
 * Step 1 of 3.
 *
 * The screen a member lands on after pointing their phone's own camera app at
 * the code on the gym wall. No camera API is used anywhere — the URL does the
 * work and this page just validates the code in it.
 *
 * A missing `?g=` is treated as valid: the owner will hand out the bare /join
 * link too, and a member who cannot get past a "no code" screen is a member
 * who does not join. A code that is present but wrong is still rejected.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; error?: string }>;
}) {
  const { g: joinCode, error } = await searchParams;

  const user = await getUser();
  if (user) redirect(homeFor(user.email));

  const supabase = await createClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("name, join_code")
    .limit(1)
    .maybeSingle();

  const codeIsWrong =
    joinCode !== undefined && gym !== null && joinCode !== gym.join_code;

  if (codeIsWrong || gym === null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-5">
        <ErrorState
          title={strings.join.invalidCode}
          body={strings.join.invalidCodeBody}
          action={
            <Link href="/">
              <Button variant="secondary">{strings.common.goHome}</Button>
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-7 pb-11 pt-[calc(4rem+env(safe-area-inset-top))]">
      <p className="text-center font-display text-[0.9375rem] font-bold tracking-[0.14em] text-ink-dim">
        {strings.join.brandmark}
      </p>

      <div className="text-center">
        <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tighter text-balance text-ink">
          {strings.join.welcomeTitle}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          {strings.join.welcomeLede}
        </p>
      </div>

      <div>
        {error ? (
          <p role="alert" className="mb-4 text-center text-sm text-danger">
            {strings.join.signInFailedBody}
          </p>
        ) : null}

        <GoogleSignInButton
          label={strings.join.signInWithGoogle}
          next="/app/complete-profile"
        />
        <p className="mt-4 text-center text-xs leading-relaxed text-ink-dim">
          {strings.join.footnote}
        </p>
      </div>
    </main>
  );
}
