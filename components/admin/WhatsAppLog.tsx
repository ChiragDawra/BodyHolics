import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MegaphoneIcon } from "@/components/ui/icons";
import { formatPhone } from "@/lib/gym";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";

export type WhatsAppRow = {
  id: string;
  type: "fee_reminder" | "invoice" | "alert";
  status: "queued" | "sent" | "failed";
  phone: string;
  body: string;
  created_at: string;
  full_name: string | null;
};

/**
 * What the gym has tried to send over WhatsApp.
 *
 * Every row will say "Queued" until a provider is connected, and the note at
 * the top says why. That is the point: the alternative is a success toast
 * over a message that went nowhere, which would have the owner believing
 * members had been told about the holiday hours.
 */
export function WhatsAppLog({ messages }: { messages: WhatsAppRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <div className="border-b border-border px-5 py-4">
        <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
          {strings.whatsapp.logHeading}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
          {strings.whatsapp.logNote}
        </p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={<MegaphoneIcon className="h-6 w-6" />}
          title={strings.whatsapp.logEmpty}
          body={strings.whatsapp.logEmptyBody}
        />
      ) : (
        <ul className="max-h-100 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="border-b border-border-soft px-5 py-3.5 last:border-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-ink">
                  {m.full_name ?? formatPhone(m.phone) ?? ""}
                </span>
                <Badge
                  tone={
                    m.status === "sent"
                      ? "success"
                      : m.status === "failed"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {strings.whatsapp.status[m.status]}
                </Badge>
              </div>

              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                {m.body}
              </p>

              <p className="mt-1.5 text-xs text-ink-faint">
                {strings.whatsapp.type[m.type]} · {formatRelative(m.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
