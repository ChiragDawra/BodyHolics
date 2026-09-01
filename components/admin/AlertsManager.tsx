"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MegaphoneIcon } from "@/components/ui/icons";
import { deleteAlert, publishAlert } from "@/lib/actions/admin";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type AlertRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export function AlertsManager({
  gymId,
  alerts,
  memberCount,
}: {
  gymId: string;
  alerts: AlertRow[];
  memberCount: number;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [pending, startTransition] = useTransition();

  const publish = () => {
    setError(null);
    setPublished(false);

    startTransition(async () => {
      const result = await publishAlert({ gymId, title, body });
      if (result.ok) {
        setTitle("");
        setBody("");
        setPublished(true);
        setTimeout(() => setPublished(false), 2500);
      } else {
        setError(result.message);
      }
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteAlert(id);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className="flex flex-col items-start gap-3.5 lg:flex-row">
      <div className="w-full flex-none rounded-lg border border-border bg-surface-raised p-5 lg:w-105">
        <p className="mb-4 font-body text-xs font-medium tracking-wide text-ink-dim">
          {strings.admin.alerts.composeHeading}
        </p>

        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            placeholder={strings.admin.alerts.titlePlaceholder}
            aria-label={strings.admin.alerts.composeHeading}
            className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-ink outline-none focus:border-border-strong"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={strings.admin.alerts.bodyPlaceholder}
            aria-label={strings.admin.alerts.bodyPlaceholder}
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink outline-none focus:border-border-strong"
          />

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button
            fullWidth
            size="lg"
            disabled={pending}
            onClick={publish}
            className={published ? "bg-success hover:bg-success" : undefined}
          >
            {published
              ? strings.admin.alerts.published
              : pending
                ? strings.admin.alerts.publishing
                : strings.admin.alerts.publish}
          </Button>
        </div>
      </div>

      <div className="min-w-0 w-full flex-1 rounded-lg border border-border bg-surface-raised p-5">
        <p className="mb-1 font-body text-xs font-medium tracking-wide text-ink-dim">
          {strings.admin.alerts.sentHeading}
        </p>

        {alerts.length === 0 ? (
          <EmptyState
            icon={<MegaphoneIcon className="h-6 w-6" />}
            title={strings.admin.alerts.empty}
            body={strings.admin.alerts.emptyBody}
          />
        ) : (
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {alerts.map((alert, i) => {
              const lead = i === 0;
              return (
                <li
                  key={alert.id}
                  className={cn(
                    "rounded-r-md border-l-4 bg-surface-overlay px-4 py-3.5",
                    lead ? "border-l-brand" : "border-l-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={cn(
                        "font-display font-bold tracking-tight",
                        lead ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      {alert.title}
                    </p>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(alert.id)}
                      className="shrink-0 font-body text-xs font-medium text-ink-dim transition-colors hover:text-danger"
                    >
                      {strings.admin.alerts.delete}
                    </button>
                  </div>

                  {alert.body ? (
                    <p
                      className={cn(
                        "mt-1.5 text-sm leading-relaxed",
                        lead ? "text-ink-muted" : "text-ink-dim",
                      )}
                    >
                      {alert.body}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-ink-dim">
                    {formatRelative(alert.created_at)} ·{" "}
                    {strings.admin.alerts.reached(memberCount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
