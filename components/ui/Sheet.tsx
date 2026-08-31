"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet. Phone-first: it rises from the bottom edge, clears the iOS
 * home indicator, and closes on Escape, backdrop tap, or the close button.
 *
 * Focus moves into the panel on open and the page behind stops scrolling, so
 * this behaves like a real modal for keyboard and screen-reader users.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "bh-rise relative w-full max-w-md rounded-t-lg",
          "bg-surface-raised border-t border-x border-border",
          "max-h-[85dvh] overflow-y-auto outline-none",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-3">
          <h2 className="font-display font-semibold text-ink text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
