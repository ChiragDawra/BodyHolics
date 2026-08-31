"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AddSquareIcon, CopyIcon, ShareIcon } from "@/components/ui/icons";
import { usePlatform, useInstallPrompt } from "@/lib/hooks/usePlatform";
import { strings } from "@/lib/strings";

/**
 * Four branches, because "add to home screen" means four different things:
 *
 *   standalone  — already installed, so get out of the way
 *   android     — Chrome gives us a real install prompt
 *   ios-safari  — no API exists; the only option is showing where Share is
 *   webview     — inside WhatsApp or Instagram, where installing is impossible
 */
export function InstallGuide() {
  const platform = usePlatform();
  const { canPrompt, promptInstall } = useInstallPrompt();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (platform === "standalone") router.replace("/app");
  }, [platform, router]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked. The URL is on screen either way.
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pb-10 pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink text-balance">
          {strings.install.title}
        </h1>
        <p className="text-ink-muted">{strings.install.lede}</p>
      </div>

      {platform === null ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : platform === "standalone" ? (
        <p className="text-ink-muted">{strings.install.alreadyInstalled}</p>
      ) : platform === "webview" ? (
        <Card>
          <CardBody className="space-y-3 pt-4">
            <h2 className="font-display text-lg font-semibold text-ink">
              {strings.install.webviewTitle}
            </h2>
            <p className="text-sm text-ink-muted">{strings.install.webviewBody}</p>
            <Button variant="secondary" fullWidth onClick={() => void copyLink()}>
              <CopyIcon className="h-5 w-5" />
              {copied ? strings.install.copied : strings.install.copyLink}
            </Button>
          </CardBody>
        </Card>
      ) : platform === "ios-safari" ? (
        <Card>
          <CardBody className="space-y-4 pt-4">
            <h2 className="font-display text-lg font-semibold text-ink">
              {strings.install.iosTitle}
            </h2>
            <ol className="space-y-3">
              {strings.install.iosSteps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-display text-sm font-semibold text-ink">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm text-ink">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-center gap-6 rounded-md bg-surface-sunken py-4 text-ink-muted">
              <ShareIcon className="h-7 w-7" />
              <span aria-hidden className="text-ink-muted">
                then
              </span>
              <AddSquareIcon className="h-7 w-7" />
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-3 pt-4">
            {canPrompt ? (
              <Button fullWidth size="lg" onClick={() => void promptInstall()}>
                {strings.install.androidCta}
              </Button>
            ) : (
              <>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {strings.install.androidFallbackTitle}
                </h2>
                <p className="text-sm text-ink-muted">
                  {strings.install.androidFallbackBody}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Button variant="ghost" onClick={() => router.push("/app")}>
        {strings.install.skip}
      </Button>
    </main>
  );
}
