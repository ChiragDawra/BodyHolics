"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { MiniGrid } from "@/components/member/ActivityGrid";
import { CloseIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import {
  addMemberDiscount,
  addMemberManually,
  recordCashPayment,
  removeMemberDiscount,
  sendFeeReminder,
} from "@/lib/actions/admin";
import {
  DISCOUNT_TERMS,
  FLAT_STEPS_RUPEES,
  PERCENT_STEPS,
  type DiscountTerm,
} from "@/lib/discounts";
import type { ActiveDiscount } from "@/lib/queries/admin";
import type { MemberListRow } from "@/lib/queries/admin";
import { formatPhone } from "@/lib/gym";
import { daysUntil, formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

type Filter = "all" | "active" | "expired" | "none";

export type OfferablePlan = {
  id: string;
  name: string;
  price_paise: number;
  duration_days: number;
  payable_paise: number;
};

export type MemberDetail = {
  memberships: Array<{
    id: string;
    start_date: string;
    end_date: string;
    plan_name: string | null;
    price_paise: number | null;
  }>;
  days: Array<{ key: string; visited: boolean }>;
  /**
   * Priced for *this* member. Plans are loaded with the detail rather than
   * once for the page because the payable figure depends on the member's own
   * discount, so a list fetched for the page would be the wrong list.
   */
  plans: OfferablePlan[];
  /** The discount the pricing function would apply, if any. */
  discount: ActiveDiscount | null;
};

function isActive(m: MemberListRow): boolean {
  return m.status === "active" && m.end_date !== null && daysUntil(m.end_date) >= 0;
}

/**
 * The members list.
 *
 * A table on the desktop and a card list on the phone, from one component —
 * the columns that get dropped on a phone (email, plan) are the ones staff do
 * not scan for; they look for a name and a status.
 *
 * Selecting a member opens a side panel on desktop and a bottom sheet on the
 * phone. Both render the same detail, fetched on demand rather than loaded for
 * all 84 members up front.
 */
export function MembersView({
  gymId,
  members,
  loadDetail,
}: {
  gymId: string;
  members: MemberListRow[];
  loadDetail: (profileId: string) => Promise<MemberDetail>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<MemberListRow | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [adding, setAdding] = useState(false);

  const activeCount = useMemo(() => members.filter(isActive).length, [members]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    /*
     * Digits only, and only when there are some. Stripping non-digits from a
     * text search leaves the empty string, and `"anything".includes("")` is
     * true — so searching for a name used to match every member in the gym
     * through the phone-number clause.
     */
    const digits = needle.replace(/\D/g, "");

    return members.filter((m) => {
      if (filter === "active" && !isActive(m)) return false;
      if (filter === "expired" && (isActive(m) || m.status === null)) return false;
      if (filter === "none" && m.status !== null) return false;
      if (needle === "") return true;

      return (
        (m.full_name ?? "").toLowerCase().includes(needle) ||
        (m.email ?? "").toLowerCase().includes(needle) ||
        (digits !== "" && (m.phone ?? "").includes(digits))
      );
    });
  }, [members, query, filter]);

  const open = async (member: MemberListRow) => {
    setSelected(member);
    setDetail(null);
    setDetail(await loadDetail(member.id));
  };

  /**
   * The panel's detail is fetched on demand for the selected member, so a
   * server action's `revalidatePath` re-renders the list behind it but leaves
   * this stale. Anything that writes calls this afterwards.
   */
  const reload = async () => {
    if (!selected) return;
    setDetail(await loadDetail(selected.id));
  };

  const close = () => {
    setSelected(null);
    setDetail(null);
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            {strings.admin.members.title}
          </h1>
          <p className="mt-1.5 text-sm text-ink-dim">
            {strings.admin.members.countLine(members.length, activeCount)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">{strings.admin.members.search}</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.admin.members.search}
            className="h-11 w-full rounded-md border border-border bg-surface-raised pl-10 pr-3 text-sm text-ink outline-none focus:border-border-strong"
          />
        </label>

        <div className="flex gap-1.5 overflow-x-auto">
          {(
            [
              ["all", strings.admin.members.filterAll],
              ["active", strings.admin.members.filterActive],
              ["expired", strings.admin.members.filterExpired],
              ["none", strings.admin.members.filterNoPlan],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "h-11 shrink-0 rounded-md border px-3.5 font-body text-xs font-medium transition-colors",
                filter === value
                  ? "border-border-strong bg-surface-overlay text-ink"
                  : "border-border text-ink-dim hover:text-ink-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title={strings.admin.members.empty}
          body={strings.admin.members.emptyBody}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title={strings.admin.members.noMatch}
          body={strings.admin.members.noMatchBody}
        />
      ) : (
        <div className="flex items-start gap-3.5">
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-raised">
            {/* Column headings are desktop-only; the phone list is cards. */}
            <div className="hidden grid-cols-[1.5fr_1.8fr_1.2fr_0.8fr_0.8fr] gap-4 border-b border-border px-5 py-3 font-body text-label font-semibold tracking-label uppercase text-ink-dim lg:grid">
              <span>{strings.admin.members.colName}</span>
              <span>{strings.admin.members.colEmail}</span>
              <span>{strings.admin.members.colPhone}</span>
              <span>{strings.admin.members.colPlan}</span>
              <span>{strings.admin.members.colStatus}</span>
            </div>

            <ul>
              {visible.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => void open(m)}
                    className={cn(
                      "w-full border-b border-border-soft px-5 py-3.5 text-left transition-colors hover:bg-surface-overlay",
                      "grid grid-cols-[1fr_auto] items-center gap-3",
                      "lg:grid-cols-[1.5fr_1.8fr_1.2fr_0.8fr_0.8fr] lg:gap-4",
                      selected?.id === m.id && "bg-surface-overlay",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {m.full_name ?? m.email ?? ""}
                      </span>
                      {/* Phone list folds the other columns into a subtitle. */}
                      <span className="mt-0.5 block truncate text-xs text-ink-dim lg:hidden">
                        {[formatPhone(m.phone) ?? strings.admin.members.noPhone, m.plan_name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>

                    <span className="hidden truncate text-xs text-ink-muted lg:block">
                      {m.email ?? ""}
                    </span>
                    <span className="hidden font-mono text-xs text-ink-muted lg:block">
                      {formatPhone(m.phone) ?? "—"}
                    </span>
                    <span className="hidden text-xs text-ink-muted lg:block">
                      {m.plan_name ?? "—"}
                    </span>

                    <Badge
                      tone={isActive(m) ? "success" : m.status === null ? "neutral" : "danger"}
                      className="justify-self-start"
                    >
                      {isActive(m)
                        ? strings.member.membershipActive
                        : m.status === null
                          ? strings.admin.members.filterNoPlan
                          : strings.member.membershipExpired}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop: detail as a side panel. */}
          {selected ? (
            <div className="bh-slide hidden w-85 flex-none rounded-lg border border-border bg-surface-raised p-5 lg:block">
              <DetailBody
                gymId={gymId}
                member={selected}
                detail={detail}
                onChanged={reload}
                onClose={close}
              />
            </div>
          ) : (
            <p className="hidden w-85 flex-none pt-2 text-xs text-ink-faint lg:block">
              {strings.admin.members.clickRow}
            </p>
          )}
        </div>
      )}

      {/* Phone: detail as a bottom sheet. */}
      <div className="lg:hidden">
        <Sheet
          open={selected !== null}
          onClose={close}
          title={selected?.full_name ?? strings.admin.members.title}
        >
          {selected ? (
            <DetailBody
              gymId={gymId}
              member={selected}
              detail={detail}
              onChanged={reload}
              onClose={close}
              hideClose
            />
          ) : null}
        </Sheet>
      </div>

      {/*
        One way to add a member, at every size.

        There were two: a button in the header that scrolls out of view, and
        this one. Two entry points for one action is a decision the reader has
        to make every time, and the header copy was the one that could not be
        reached while looking at the list you wanted to add to.

        Fixed bottom-right, clear of the phone tab bar (which is 4rem tall
        plus its own inset) and of the safe area.
      */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label={strings.admin.members.addManually}
        className={cn(
          "fixed right-5 z-40 flex h-13 items-center gap-2 rounded-full",
          "bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:bottom-6",
          "bg-brand px-5 font-display text-sm font-semibold text-on-brand",
          "shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-colors hover:bg-brand-hover",
        )}
      >
        <PlusIcon className="h-4.5 w-4.5" strokeWidth={2.2} />
        {strings.admin.members.addShort}
      </button>

      <AddMemberSheet gymId={gymId} open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function DetailBody({
  gymId,
  member,
  detail,
  onChanged,
  onClose,
  hideClose = false,
}: {
  gymId: string;
  member: MemberListRow;
  detail: MemberDetail | null;
  onChanged: () => Promise<void>;
  onClose: () => void;
  hideClose?: boolean;
}) {
  const active = isActive(member);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold tracking-tight text-ink">
            {member.full_name ?? ""}
          </p>
          <p className="mt-1 truncate text-xs text-ink-muted">{member.email ?? ""}</p>
          <p className="mt-0.5 font-mono text-xs text-ink-muted">
            {formatPhone(member.phone) ?? strings.admin.members.noPhone}
          </p>
        </div>
        {hideClose ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.common.close}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-dim hover:bg-surface-overlay"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="mt-3.5 text-xs text-ink-dim">
        {strings.admin.members.emergencyContact(
          member.emergency_contact ?? strings.admin.members.notGiven,
        )}
      </p>

      <div className="mt-4.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-md border border-border bg-surface p-3.5">
          <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.members.status}
          </p>
          <p
            className={cn(
              "mt-2 font-display text-[0.9375rem] font-bold",
              active ? "text-success" : "text-danger",
            )}
          >
            {active
              ? strings.member.membershipActive
              : member.status === null
                ? strings.admin.members.filterNoPlan
                : strings.member.membershipExpired}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3.5">
          <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.members.pendingDues}
          </p>
          <p
            className={cn(
              "mt-2 font-display text-[0.9375rem] font-bold",
              member.duesPaise > 0 ? "text-warning" : "text-ink",
            )}
          >
            {member.duesPaise > 0
              ? strings.common.rupees(member.duesPaise)
              : strings.admin.members.none}
          </p>
        </div>
      </div>

      {member.duesPaise > 0 ? <FeeReminder member={member} /> : null}

      <p className="mb-2.5 mt-5 font-body text-label font-semibold tracking-label uppercase text-ink-dim">
        {strings.admin.members.membershipHistory}
      </p>
      {detail === null ? (
        <p className="text-xs text-ink-faint">{strings.common.loading}</p>
      ) : detail.memberships.length === 0 ? (
        <p className="text-xs text-ink-faint">{strings.admin.members.noMemberships}</p>
      ) : (
        detail.memberships.map((m, i) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 border-t border-border-soft py-2.5"
          >
            <span className={cn("text-xs", i === 0 ? "text-ink" : "text-ink-dim")}>
              {m.plan_name ?? ""} · {formatDay(m.start_date)} – {formatDay(m.end_date)}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs font-medium",
                i === 0 ? "text-ink-muted" : "text-ink-dim",
              )}
            >
              {m.price_paise === null ? "" : strings.common.rupees(m.price_paise)}
            </span>
          </div>
        ))
      )}

      <p className="mb-2.5 mt-5 font-body text-label font-semibold tracking-label uppercase text-ink-dim">
        {strings.admin.members.attendance30}
      </p>
      {detail === null ? (
        <div className="h-6" />
      ) : (
        <MiniGrid days={detail.days} />
      )}

      {detail ? (
        <>
          <MemberDiscount
            gymId={gymId}
            member={member}
            discount={detail.discount}
            onChanged={onChanged}
          />
          <CashPayment
            member={member}
            plans={detail.plans}
            onChanged={onChanged}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * Nudge a member who owes something.
 *
 * Only rendered when there is actually an outstanding amount — a reminder
 * button on a paid-up member is a way to annoy a customer by accident. The
 * message says "queued", not "sent", because that is what happened.
 */
function FeeReminder({ member }: { member: MemberListRow }) {
  const [state, setState] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await sendFeeReminder({ profileId: member.id });
      if (result.ok) setState("done");
      else setError(result.message);
    });
  };

  return (
    <div className="mt-3">
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        disabled={pending || state === "done"}
        onClick={send}
      >
        {pending
          ? strings.whatsapp.sendingReminder
          : strings.whatsapp.sendReminder}
      </Button>

      {state === "done" ? (
        <p role="status" className="mt-2 text-xs leading-relaxed text-ink-dim">
          {strings.whatsapp.reminderQueued}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A price that is lower for this member than the list price.
 *
 * One discount at a time: adding a second would be ambiguous at the desk and
 * the pricing function only ever applies the newest, so the form is replaced
 * by the live discount once one exists, with a way to remove it.
 */
function MemberDiscount({
  gymId,
  member,
  discount,
  onChanged,
}: {
  gymId: string;
  member: MemberListRow;
  discount: ActiveDiscount | null;
  onChanged: () => Promise<void>;
}) {
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("20");
  const [term, setTerm] = useState<DiscountTerm>("3m");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await addMemberDiscount({
        gymId,
        memberId: member.id,
        discountType: type,
        value,
        term,
      });

      if (result.ok) {
        setOpen(false);
        await onChanged();
      } else {
        setError(result.message);
      }
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberDiscount(id);
      if (result.ok) await onChanged();
      else setError(result.message);
    });
  };

  return (
    <div className="mt-5 border-t border-border-soft pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
          {strings.admin.members.discountHeading}
        </p>
        {discount ? null : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-body text-xs font-medium text-brand hover:text-brand-hover"
          >
            {strings.admin.members.addDiscount}
          </button>
        )}
      </div>

      {discount ? (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <Badge tone="brand">
            {strings.admin.members.discountActive(
              discount.discount_type === "percent"
                ? `${discount.value}% off`
                : `${strings.common.rupees(discount.value)} off`,
              discount.expires_at === null
                ? strings.admin.members.discountForever
                : strings.admin.members.discountUntil(formatDay(discount.expires_at)),
            )}
          </Badge>
          <button
            type="button"
            disabled={pending}
            onClick={() => remove(discount.id)}
            className="font-body text-xs font-medium text-ink-dim transition-colors hover:text-danger disabled:opacity-60"
          >
            {strings.admin.members.discountRemove}
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-ink-dim">
          {strings.admin.members.discountNone}
        </p>
      )}

      {open && !discount ? (
        <div className="mt-3 flex flex-col gap-2.5 rounded-md border border-border bg-surface p-3.5">
          <select
            value={type}
            aria-label={strings.admin.members.discountType}
            onChange={(e) => {
              const next = e.target.value as "percent" | "flat";
              setType(next);
              setValue(next === "percent" ? "20" : "200");
            }}
            className="h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-ink outline-none focus:border-border-strong"
          >
            <option value="percent">{strings.admin.members.discountPercent}</option>
            <option value="flat">{strings.admin.members.discountFlat}</option>
          </select>

          <select
            value={value}
            aria-label={strings.admin.members.discountValue}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-ink outline-none focus:border-border-strong"
          >
            {(type === "percent"
              ? PERCENT_STEPS
              : FLAT_STEPS_RUPEES
            ).map((n) => (
              <option key={n} value={n}>
                {type === "percent" ? `${n}%` : strings.common.rupees(n * 100)}
              </option>
            ))}
          </select>

          <select
            value={term}
            aria-label={strings.admin.members.discountTerm}
            onChange={(e) => setTerm(e.target.value as DiscountTerm)}
            className="h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-ink outline-none focus:border-border-strong"
          >
            {DISCOUNT_TERMS.map((t) => (
              <option key={t} value={t}>
                {strings.admin.members.discountTerms[t]}
              </option>
            ))}
          </select>

          <Button size="sm" disabled={pending} onClick={save}>
            {pending
              ? strings.admin.members.discountSaving
              : strings.admin.members.discountSave}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Taking cash at the desk.
 *
 * Admin-initiated and admin-only. A member never requests anything — they are
 * told to pay at the desk, they hand over the money, and this is where that
 * becomes a membership. The amount is not entered by hand: it comes from the
 * plan and the member's discount, computed in the database, so what the
 * member was quoted on their phone and what is recorded here cannot differ.
 */
function CashPayment({
  member,
  plans,
  onChanged,
}: {
  member: MemberListRow;
  plans: OfferablePlan[];
  onChanged: () => Promise<void>;
}) {
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (plans.length === 0) return null;

  const chosen = plans.find((p) => p.id === planId) ?? null;

  const submit = () => {
    if (!chosen) {
      setError(strings.admin.members.recordPaymentPickPlan);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await recordCashPayment({
        profileId: member.id,
        planId: chosen.id,
      });

      if (result.ok) {
        setDone(true);
        setPlanId("");
        await onChanged();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="mt-5 border-t border-border-soft pt-4">
      <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
        {strings.admin.members.recordPaymentTitle}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
        {strings.admin.members.recordPaymentBody}
      </p>

      <select
        value={planId}
        aria-label={strings.admin.members.plan}
        onChange={(e) => {
          setPlanId(e.target.value);
          setDone(false);
          setError(null);
        }}
        className="mt-3 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
      >
        <option value="">{strings.admin.members.plan}</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name} · {strings.common.rupees(plan.payable_paise)}
            {plan.payable_paise < plan.price_paise
              ? ` (${strings.common.rupees(plan.price_paise)})`
              : ""}
          </option>
        ))}
      </select>

      {error ? (
        <p role="alert" className="mt-2.5 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {done ? (
        <p role="status" className="mt-2.5 text-xs text-success">
          {strings.admin.members.recordPaymentSaved}
        </p>
      ) : null}

      <Button fullWidth className="mt-3" disabled={pending} onClick={submit}>
        {pending
          ? strings.admin.members.recordPaymentSaving
          : strings.admin.members.recordPaymentSubmit}
      </Button>
    </div>
  );
}

function AddMemberSheet({
  gymId,
  open,
  onClose,
}: {
  gymId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addMemberManually({ gymId, fullName: name, phone, email });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setName("");
      setPhone("");
      setEmail("");
      onClose();
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title={strings.admin.members.addTitle}>
      <p className="mb-4 text-sm text-ink-muted">{strings.admin.members.addBody}</p>

      <div className="flex flex-col gap-3.5">
        <Labelled label={strings.admin.members.addName}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-ink outline-none focus:border-border-strong"
          />
        </Labelled>
        <Labelled label={strings.admin.members.addPhone}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-ink outline-none focus:border-border-strong"
          />
        </Labelled>
        <Labelled label={strings.admin.members.addEmail}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-ink outline-none focus:border-border-strong"
          />
        </Labelled>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button fullWidth disabled={pending} onClick={submit}>
          {pending ? strings.admin.members.addSaving : strings.admin.members.addSubmit}
        </Button>
      </div>
    </Sheet>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-label font-semibold tracking-label uppercase text-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
