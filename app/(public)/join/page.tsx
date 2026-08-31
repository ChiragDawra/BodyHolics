import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { CheckIcon } from "@/components/ui/icons";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.join.title };

/**
 * The screen a member lands on after pointing their phone's own camera app at
 * the code on the gym wall. No camera API is used anywhere — the URL does the
 * work, and this page just validates the code in it.
 *
 * A missing `?g=` is treated as valid rather than an error: the owner will
 * hand out the bare /join link too, and a member who cannot get past a
 * "no code" screen is a member who does not join.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; error?: string }>;
}) {
  const { g: joinCode, error } = await searchParams;

  // Already signed in? They have joined; send them to the app.
  if (await getUser()) redirect("/app");

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div className="space-y-3">
        <p className="font-display text-sm font-semibold text-brand">
          {gym.name}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink text-balance">
          {strings.join.title}
        </h1>
        <p className="text-ink-muted">{strings.join.intro}</p>
      </div>

      <Card>
        <CardBody className="space-y-3 pt-4">
          <h2 className="font-display font-semibold text-ink">
            {strings.join.whatYouGet}
          </h2>
          <ul className="space-y-2.5">
            {strings.join.benefits.map((benefit) => (
              <li key={benefit} className="flex gap-2.5 text-sm text-ink">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {benefit}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {strings.join.signInFailedBody}
        </p>
      ) : null}

      <div className="space-y-3">
        <GoogleSignInButton
          label={strings.join.signInWithGoogle}
          next="/install"
        />
        <p className="text-center text-xs text-ink-muted">
          {strings.join.footnote}
        </p>
      </div>
    </main>
  );
}
