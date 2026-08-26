'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { updateHoursAction } from '../api';
import { WEEKDAYS, type HoursActionResult, type HoursRow } from '../types';

const INITIAL: HoursActionResult = { status: 'idle' };

export function HoursForm({ hours }: { hours: HoursRow[] }) {
  const [state, action, pending] = useActionState(updateHoursAction, INITIAL);
  // Local state only so the time inputs can disable themselves when a day is
  // marked closed. The values still submit through the form.
  const [closed, setClosed] = useState(() => hours.map((row) => row.isClosed));

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-3">
        {hours.map((row, index) => (
          <div
            key={row.weekday}
            className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[8rem_auto_1fr]"
          >
            <Label htmlFor={`opens-${row.weekday}`} className="text-sm">
              {WEEKDAYS[row.weekday]}
            </Label>

            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input
                type="checkbox"
                name={`closed-${row.weekday}`}
                defaultChecked={row.isClosed}
                onChange={(event) =>
                  setClosed((previous) =>
                    previous.map((value, position) =>
                      position === index ? event.target.checked : value,
                    ),
                  )
                }
              />
              Closed
            </label>

            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              <Input
                id={`opens-${row.weekday}`}
                name={`opens-${row.weekday}`}
                type="time"
                defaultValue={row.opensAt ?? ''}
                disabled={closed[index]}
                aria-label={`${WEEKDAYS[row.weekday]} opening time`}
                className="numeric max-w-[8rem]"
              />
              <span className="text-sm text-[var(--text-muted)]">to</span>
              <Input
                name={`closes-${row.weekday}`}
                type="time"
                defaultValue={row.closesAt ?? ''}
                disabled={closed[index]}
                aria-label={`${WEEKDAYS[row.weekday]} closing time`}
                className="numeric max-w-[8rem]"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        {/* Q5 — same-day windows only; an overnight span is rejected rather than
            silently wrapping past midnight. */}
        Closing time must be later than opening time on the same day.
      </p>

      {state.status !== 'idle' ? (
        <p
          role="status"
          className={state.status === 'error' ? 'text-sm text-danger-500' : 'text-sm text-accent-600'}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save hours'}
      </Button>
    </form>
  );
}
