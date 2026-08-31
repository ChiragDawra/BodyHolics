"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MegaphoneIcon } from "@/components/ui/icons";
import { deleteAlert, publishAlert } from "@/lib/actions/admin";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";

export type AlertRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export function AlertsManager({
  gymId,
  alerts,
}: {
  gymId: string;
  alerts: AlertRow[];
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={strings.admin.alerts.composeHeading}
          action={published ? <Badge tone="success">{strings.admin.alerts.published}</Badge> : null}
        />
        <CardBody className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block font-display text-sm font-semibold text-ink">
              {strings.admin.alerts.titleLabel}
            </span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder={strings.admin.alerts.titlePlaceholder}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-display text-sm font-semibold text-ink">
              {strings.admin.alerts.bodyLabel}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={strings.admin.alerts.bodyPlaceholder}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button onClick={publish} disabled={pending}>
            {pending ? strings.admin.alerts.publishing : strings.admin.alerts.publish}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={strings.admin.alerts.sentHeading} />
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState
              icon={<MegaphoneIcon className="h-6 w-6" />}
              title={strings.admin.alerts.empty}
              body={strings.admin.alerts.emptyBody}
            />
          ) : (
            <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink">
                        {alert.title}
                      </p>
                      {alert.body ? (
                        <p className="mt-0.5 text-sm text-ink-muted">{alert.body}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatRelative(alert.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(alert.id)}
                    >
                      {strings.admin.alerts.delete}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
