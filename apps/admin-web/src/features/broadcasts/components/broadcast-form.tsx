'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { publishBroadcastAction } from '../api';
import type { BroadcastActionResult } from '../types';

const INITIAL: BroadcastActionResult = { status: 'idle' };

const CATEGORIES = [
  'GENERAL',
  'HOLIDAY',
  'MAINTENANCE',
  'EQUIPMENT',
  'EVENT',
  'LOST_AND_FOUND',
] as const;

const AUDIENCES = [
  { value: 'ALL_MEMBERS', label: 'Everyone at the gym' },
  { value: 'ACTIVE_MEMBERS', label: 'Members with a current membership' },
  { value: 'EXPIRING_MEMBERS', label: 'Members expiring soon' },
  { value: 'INACTIVE_MEMBERS', label: 'Members without a current membership' },
] as const;

export function BroadcastForm() {
  const [state, action, pending] = useActionState(publishBroadcastAction, INITIAL);
  const [schedule, setSchedule] = useState(false);

  const selectClass =
    'h-10 w-full rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 text-sm';

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} maxLength={120} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <textarea
          id="body"
          name="body"
          required
          maxLength={2000}
          rows={5}
          className="w-full rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-3 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" className={selectClass} defaultValue="GENERAL">
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audienceType">Audience</Label>
          {/* An audience is a rule, evaluated server-side at publish time. This
              control chooses the rule; it never sends a list of members. */}
          <select
            id="audienceType"
            name="audienceType"
            className={selectClass}
            defaultValue="ALL_MEMBERS"
          >
            {AUDIENCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={schedule}
            onChange={(event) => setSchedule(event.target.checked)}
          />
          Schedule for later
        </label>
        {schedule ? (
          <Input id="publishAt" name="publishAt" type="datetime-local" required className="max-w-xs" />
        ) : null}
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        A sent announcement cannot be edited — recipients have already been told. To correct one,
        send a new announcement.
      </p>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger-500">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : schedule ? 'Schedule announcement' : 'Send now'}
      </Button>
    </form>
  );
}
