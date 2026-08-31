"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type Platform = "standalone" | "android" | "ios-safari" | "webview" | "other";

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari does not implement display-mode and uses this instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (standalone) return "standalone";

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  // In-app browsers cannot add to the home screen at all, so they get their own
  // branch telling the visitor to open the link properly.
  const inWebView =
    /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|Twitter|LinkedInApp/.test(ua) ||
    (isAndroid && /; wv\)/.test(ua));

  if (inWebView) return "webview";
  if (isIOS) return "ios-safari";
  if (isAndroid) return "android";
  return "other";
}

/** Nothing to subscribe to — the platform cannot change mid-session. */
const noopSubscribe = () => () => {};

/**
 * Which set of install instructions the visitor needs.
 *
 * Read through useSyncExternalStore rather than an effect, so the server
 * snapshot is `null` ("not decided yet") and the browser value arrives without
 * a cascading re-render. Callers show nothing while it is null rather than
 * flashing the wrong guide.
 */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(noopSubscribe, detectPlatform, () => null);
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Captures Chrome's beforeinstallprompt so the page can trigger it on a tap. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const promptInstall = async () => {
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") setEvent(null);
    return choice.outcome === "accepted";
  };

  return { canPrompt: event !== null, promptInstall };
}
