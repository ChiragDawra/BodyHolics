"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BackspaceIcon, LockIcon, LockOpenIcon } from "@/components/ui/icons";
import { PIN_LENGTH, isPinLocallyValid } from "@/lib/checkPin";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

type Phase = "entry" | "wrong" | "unlocked";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Bank-app style lock screen.
 *
 * Masked dots, a numpad, auto-submit on the fourth digit, shake and clear on a
 * wrong PIN, and a lock icon that opens with a green pulse on the right one.
 *
 * The entered PIN lives in React state and nowhere else — no localStorage, no
 * cookie. Closing the tab re-locks the app, which is what the owner expects
 * from something sitting unlocked on the front desk.
 */
export function PinPad({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<Phase>("entry");

  // Tracked so unmounting mid-animation cannot set state on a gone component.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  /**
   * Reaching the fourth digit *is* the submit, so the outcome is decided in
   * the handler rather than in an effect watching `pin`. Effects that set
   * state synchronously cause a second render pass for no reason.
   */
  const commit = useCallback(
    (entered: string) => {
      if (isPinLocallyValid(entered)) {
        setPhase("unlocked");
        timer.current = setTimeout(() => onUnlock(entered), 620);
        return;
      }

      setPhase("wrong");
      timer.current = setTimeout(() => {
        setPin("");
        setPhase("entry");
      }, 420);
    },
    [onUnlock],
  );

  const press = useCallback(
    (digit: string) => {
      if (phase === "unlocked" || pin.length >= PIN_LENGTH) return;

      const next = pin + digit;
      setPin(next);
      setPhase("entry");

      if (next.length === PIN_LENGTH) commit(next);
    },
    [pin, phase, commit],
  );

  const backspace = useCallback(() => {
    if (phase === "unlocked" || pin.length === PIN_LENGTH) return;
    setPin(pin.slice(0, -1));
    setPhase("entry");
  }, [pin, phase]);

  // A physical keyboard should work too — the owner may open this on a laptop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace]);

  const wrong = phase === "wrong";
  const unlocked = phase === "unlocked";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-surface-sunken px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="relative flex h-16 w-16 items-center justify-center">
          {unlocked ? (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-success animate-[bh-pulse-ring_0.7s_ease-out]"
            />
          ) : null}
          <span
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300",
              unlocked
                ? "bg-success text-on-brand"
                : wrong
                  ? "bg-danger-subtle text-danger"
                  : "bg-surface-raised text-ink-muted",
            )}
          >
            {unlocked ? (
              <LockOpenIcon className="h-7 w-7" strokeWidth={2.2} />
            ) : (
              <LockIcon className="h-7 w-7" strokeWidth={2.2} />
            )}
          </span>
        </div>

        <div className="flex flex-col items-center gap-4">
          <p
            aria-live="polite"
            className={cn(
              "font-display text-lg font-semibold transition-colors",
              wrong ? "text-danger" : unlocked ? "text-success" : "text-ink",
            )}
          >
            {wrong
              ? strings.check.pinWrong
              : unlocked
                ? strings.check.pinLocked
                : strings.check.pinPrompt}
          </p>

          <div className={cn("flex gap-4", wrong && "bh-shake")}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-all duration-150",
                  i < pin.length
                    ? wrong
                      ? "border-danger bg-danger"
                      : unlocked
                        ? "border-success bg-success"
                        : "border-ink bg-ink"
                    : "border-border-strong bg-transparent",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-ink-muted">{strings.check.pinHint}</p>
        </div>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <PadButton key={key} label={key} onClick={() => press(key)} />
        ))}
        <span aria-hidden />
        <PadButton label="0" onClick={() => press("0")} />
        <button
          type="button"
          onClick={backspace}
          aria-label={strings.check.backspace}
          disabled={unlocked}
          className="flex h-16 items-center justify-center rounded-md text-ink-muted transition-colors active:bg-surface-raised disabled:opacity-40"
        >
          <BackspaceIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function PadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={strings.check.digit(Number(label))}
      className={cn(
        "flex h-16 items-center justify-center rounded-md",
        "bg-surface-raised border border-border",
        "font-display text-2xl font-semibold text-ink",
        "transition-transform duration-75 active:scale-95 active:bg-surface-sunken",
      )}
    >
      {label}
    </button>
  );
}
