"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { usePlatform, useInstallPrompt } from "@/lib/hooks/usePlatform";
import { strings } from "@/lib/strings";

/**
 * Step 3 of the join flow: "You're in".
 *
 * Confirmation and the install prompt are the same screen on purpose. The
 * moment a member has just finished a form is the only moment they are
 * willing to do one more thing, and adding to the home screen is the single
 * action that decides whether this app gets opened again.
 *
 * Android gets the real prompt; iOS gets the Share instructions, because
 * Safari exposes no API for it.
 */
export function InstallHandoff() {
  const router = useRouter();
  const platform = usePlatform();
  const { canPrompt, promptInstall } = useInstallPrompt();

  const goToApp = () => router.replace("/app");

  const install = async () => {
    if (canPrompt) await promptInstall();
    goToApp();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-7 pb-11 pt-[calc(4rem+env(safe-area-inset-top))]">
      <div aria-hidden className="flex items-center gap-2.5">
        <span className="h-[0.1875rem] flex-1 rounded-full bg-brand" />
        <span className="h-[0.1875rem] flex-1 rounded-full bg-brand" />
        <span className="h-[0.1875rem] flex-1 rounded-full bg-brand" />
      </div>

      <div>
        <div className="relative mb-7 flex h-13.5 w-13.5 items-center justify-center rounded-full border border-success/40 text-success">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-success animate-[bh-halo_2.4s_ease-out_infinite]"
          />
          <CheckIcon className="relative h-6 w-6" strokeWidth={2} />
        </div>

        <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tighter text-ink">
          {strings.join.doneTitle}
        </h1>
        <p className="mt-3.5 text-base leading-relaxed text-pretty text-ink-muted">
          {strings.join.doneLede}
        </p>

        {platform === "ios-safari" ? (
          <div className="mt-6 rounded-md border border-border bg-surface-raised p-4">
            <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
              {strings.join.iosHeading}
            </p>
            <p className="mt-2.5 text-sm leading-loose text-ink-muted">
              {strings.join.iosBody}
            </p>
          </div>
        ) : null}
      </div>

      <div>
        <Button size="lg" fullWidth onClick={() => void install()}>
          {strings.join.addToHome}
        </Button>
        <button
          type="button"
          onClick={goToApp}
          className="mt-4 block w-full font-body text-sm font-medium text-ink-dim transition-colors hover:text-ink-muted"
        >
          {strings.join.skip}
        </button>
      </div>
    </main>
  );
}
