"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { MiniGrid } from "@/components/member/ActivityGrid";
import { CloseIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { addMemberManually } from "@/lib/actions/admin";
import type { MemberListRow } from "@/lib/queries/admin";
import { formatPhone } from "@/lib/gym";
import { daysUntil, formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

type Filter = "all" | "active" | "expired" | "none";

export type MemberDetail = {
  memberships: Array<{
    id: string;
    start_date: string;
    end_date: string;
    plan_name: string | null;
    price_paise: number | null;
  }>;
  days: Array<{ key: string; visited: boolean }>;
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

    return members.filter((m) => {
      if (filter === "active" && !isActive(m)) return false;
      if (filter === "expired" && (isActive(m) || m.status === null)) return false;
      if (filter === "none" && m.status !== null) return false;
      if (needle === "") return true;

      return (
        (m.full_name ?? "").toLowerCase().includes(needle) ||
        (m.email ?? "").toLowerCase().includes(needle) ||
        (m.phone ?? "").includes(needle.replace(/\D/g, ""))
      );
    });
  }, [members, query, filter]);

  const open = async (member: MemberListRow) => {
    setSelected(member);
    setDetail(null);
    setDetail(await loadDetail(member.id));
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
        <Button onClick={() => setAdding(true)} className="hidden sm:inline-flex">
          <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
          {strings.admin.members.addManually}
        </Button>
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
            <div className="hidden grid-cols-[1.5fr_1.8fr_1.2fr_0.8fr_0.8fr] gap-4 border-b border-border px-5 py-3 font-body text-[0.625rem] font-medium tracking-wider text-ink-dim lg:grid">
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
              <DetailBody member={selected} detail={detail} onClose={close} />
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
            <DetailBody member={selected} detail={detail} onClose={close} hideClose />
          ) : null}
        </Sheet>
      </div>

      {/* Floating add button on the phone, where the header button is hidden. */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="fixed bottom-28 right-5 z-40 flex h-12 items-center gap-2 rounded-md bg-brand px-4.5 font-display text-sm font-semibold text-on-brand shadow-lg transition-colors hover:bg-brand-hover sm:hidden"
      >
        <PlusIcon className="h-4 w-4" strokeWidth={2.2} />
        {strings.admin.members.addShort}
      </button>

      <AddMemberSheet gymId={gymId} open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function DetailBody({
  member,
  detail,
  onClose,
  hideClose = false,
}: {
  member: MemberListRow;
  detail: MemberDetail | null;
  onClose: () => void;
  hideClose?: boolean;
}) {
  const [toast, setToast] = useState(false);
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
          <p className="font-body text-[0.625rem] font-medium tracking-wide text-ink-dim">
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
          <p className="font-body text-[0.625rem] font-medium tracking-wide text-ink-dim">
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

      <p className="mb-2.5 mt-5 font-body text-[0.625rem] font-medium tracking-wider text-ink-dim">
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

      <p className="mb-2.5 mt-5 font-body text-[0.625rem] font-medium tracking-wider text-ink-dim">
        {strings.admin.members.attendance30}
      </p>
      {detail === null ? (
        <div className="h-6" />
      ) : (
        <MiniGrid days={detail.days} />
      )}

      <Button
        variant="disabled"
        fullWidth
        className="mt-5"
        aria-disabled
        onClick={() => {
          setToast(true);
          setTimeout(() => setToast(false), 2600);
        }}
      >
        {strings.admin.members.recordPayment}
      </Button>
      {toast ? (
        <p role="status" className="mt-2.5 text-xs leading-relaxed text-warning">
          {strings.admin.members.recordPaymentToast}
        </p>
      ) : null}
    </>
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
      <span className="mb-1.5 block font-body text-xs font-medium tracking-wide text-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
