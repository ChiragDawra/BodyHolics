"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { checkStaffCode, completeProfile } from "@/lib/actions/profile";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * Step 2 of the join flow: the details the desk needs.
 *
 * Phone is the only required field, because it is the only one the gym
 * genuinely cannot operate without. Emergency contact is offered but never
 * insisted on — a required field a member does not want to fill is a member
 * who abandons the form.
 *
 * The staff code is validated server-side as it is typed. The client never
 * learns what a valid code is, only whether the one entered happens to work.
 */
export function CompleteProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [emergency, setEmergency] = useState("");
  const [code, setCode] = useState("");
  const [codeOk, setCodeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState(false);
  const [pending, startTransition] = useTransition();

  const onCodeChange = (value: string) => {
    setCode(value);
    setCodeOk(false);
    // Only ask the server once the code is long enough to plausibly be one.
    if (value.trim().length < 6) return;
    void checkStaffCode(value).then(setCodeOk);
  };

  const submit = () => {
    setError(null);
    setPhoneError(false);

    if (phone.replace(/\D/g, "").length < 10) {
      setPhoneError(true);
      return;
    }

    startTransition(async () => {
      const result = await completeProfile({
        fullName: name,
        phone,
        emergencyContact: emergency,
        staffCode: code,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Staff go straight to the dashboard; members get the install handoff.
      router.replace(result.staffGranted ? "/admin" : "/join/done");
    });
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-8 pt-[calc(2.25rem+env(safe-area-inset-top))]">
      <div aria-hidden className="mb-5.5 flex items-center gap-2.5">
        <span className="h-[0.1875rem] flex-1 rounded-full bg-brand" />
        <span className="h-[0.1875rem] flex-1 rounded-full bg-brand" />
        <span className="h-[0.1875rem] flex-1 rounded-full bg-surface-high" />
      </div>

      <h1 className="font-display text-[1.6875rem] leading-tight font-bold tracking-tight text-ink">
        {strings.join.detailsTitle}
      </h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-ink-muted">
        {strings.join.detailsLede}
      </p>

      <div className="flex flex-col gap-4">
        <Field label={strings.join.fullName}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="h-12 w-full rounded-md border border-border bg-surface-raised px-3.5 text-base text-ink outline-none focus:border-border-strong"
          />
        </Field>

        <Field label={strings.join.emailFromGoogle}>
          <div className="flex h-12 w-full items-center rounded-md border border-border-soft bg-surface-raised/60 px-3.5 text-base text-ink-faint">
            <span className="truncate">{email}</span>
          </div>
        </Field>

        <Field label={strings.join.phone}>
          <div
            className={cn(
              "flex h-12 items-center gap-2.5 rounded-md border bg-surface-raised px-3.5",
              phoneError ? "border-danger" : "border-border",
            )}
          >
            <span aria-hidden className="text-base text-ink-dim">
              +91
            </span>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(false);
              }}
              placeholder={strings.join.phonePlaceholder}
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={phoneError}
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
            />
          </div>
          {phoneError ? (
            <span role="alert" className="mt-1.5 block text-xs text-danger">
              {strings.join.phoneRequired}
            </span>
          ) : null}
        </Field>

        <Field label={strings.join.emergency}>
          <input
            value={emergency}
            onChange={(e) => setEmergency(e.target.value)}
            placeholder={strings.join.emergencyPlaceholder}
            className="h-12 w-full rounded-md border border-border bg-surface-raised px-3.5 text-base text-ink outline-none focus:border-border-strong"
          />
        </Field>

        <div className="rounded-md border border-border-soft bg-surface-raised/60 px-4 py-3.5">
          <p className="text-sm font-medium text-ink-muted">
            {strings.join.staffCodeHeading}
          </p>
          <div className="mt-2.5 flex gap-2">
            <input
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder={strings.join.staffCodePlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
              className={cn(
                "h-10.5 min-w-0 flex-1 rounded-sm border border-dashed bg-surface px-3",
                "font-mono text-sm tracking-widest text-ink outline-none",
                codeOk ? "border-success" : "border-border",
              )}
            />
            {codeOk ? (
              <span className="flex h-10.5 flex-none items-center gap-1.5 rounded-sm bg-success/15 px-3 font-body text-xs font-semibold text-success">
                <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                {strings.join.staffCodeAccepted}
              </span>
            ) : null}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
            {strings.join.staffCodeHint}
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button size="lg" fullWidth disabled={pending} onClick={submit}>
          {pending ? strings.join.submitting : strings.join.submit}
        </Button>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-xs font-medium tracking-wide text-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
