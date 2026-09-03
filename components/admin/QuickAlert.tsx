"use client";

import { useState, useTransition } from "react";
import { publishAlert } from "@/lib/actions/admin";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * One-field alert composer for the phone.
 *
 * Title only, no body: the owner using this is standing at the desk with one
 * hand free, and "Closing early today" is the whole message. The full composer
 * with a body lives on the Alerts page for when there is more to say.
 */
export function QuickAlert({ gymId }: { gymId: string }) {
  const [title, setTitle] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "invalid">("idle");
  const [pending, startTransition] = useTransition();

  const send = () => {
    if (title.trim() === "") {
      setState("invalid");
      return;
    }

    startTransition(async () => {
      const result = await publishAlert({ gymId, title, body: "" });
      if (!result.ok) {
        setState("invalid");
        return;
      }
      setTitle("");
      setState("sent");
      setTimeout(() => setState("idle"), 2400);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="mb-3 font-body text-label font-semibold tracking-label uppercase text-ink-dim">
        {strings.admin.dashboard.quickAlert}
      </p>

      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (state === "invalid") setState("idle");
          }}
          placeholder={strings.admin.alerts.titlePlaceholder}
          aria-label={strings.admin.alerts.composeHeading}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3.5 text-sm text-ink outline-none focus:border-border-strong"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className={cn(
            "h-11 flex-none rounded-md px-4.5 font-display text-sm font-semibold transition-colors",
            state === "sent"
              ? "bg-success text-on-brand"
              : "bg-brand text-on-brand hover:bg-brand-hover",
            pending && "opacity-70",
          )}
        >
          {state === "sent" ? strings.admin.alerts.published : strings.admin.alerts.send}
        </button>
      </div>

      {state === "invalid" ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {strings.admin.alerts.needsTitle}
        </p>
      ) : null}
    </div>
  );
}
