import { CheckCircleIcon, TagIcon } from "@/components/ui/icons";
import { formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type MemberPayment = {
  id: string;
  paid_at: string;
  amount_paise: number;
  status: "collected" | "pending" | "refunded";
};

/**
 * One line of payment history: date on the left, amount on the right, and the
 * status underneath as an icon and a word.
 *
 * The status goes on its own line rather than into a third column because on
 * a phone the two things a member scans for are "when" and "how much" — those
 * get the full width and stay aligned down the list, and the state they only
 * check when something looks wrong sits quietly below.
 */
export function PaymentHistoryRow({ payment }: { payment: MemberPayment }) {
  const collected = payment.status === "collected";

  return (
    <li className="border-b border-border-soft py-3.5 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-ink">
          {formatDay(payment.paid_at)}
        </span>
        <span className="font-display text-sm font-semibold text-ink">
          {strings.common.rupees(payment.amount_paise)}
        </span>
      </div>

      <div
        className={cn(
          "mt-1.5 flex items-center gap-1.5",
          collected ? "text-brand" : "text-warning",
        )}
      >
        {collected ? (
          <CheckCircleIcon className="h-3.5 w-3.5" strokeWidth={1.9} />
        ) : (
          <TagIcon className="h-3.5 w-3.5" strokeWidth={1.9} />
        )}
        <span className="text-xs font-medium">
          {strings.admin.revenue.status[payment.status]}
        </span>
      </div>
    </li>
  );
}
