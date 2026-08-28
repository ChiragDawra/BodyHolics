import { formatInTimeZone } from 'date-fns-tz';

/**
 * Money formatting lives in packages/domain so both clients render the same
 * number the same way — en-IN groups as 2,2,3 (lakh/crore), not 3,3,3, and two
 * hand-rolled copies of that will not stay in agreement.
 */
export { formatPaise } from '@gym/domain';

/** Compact form for KPI tiles: ₹1.2L rather than ₹1,20,000. */
export function formatPaiseCompact(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(paise / 100);
}

/**
 * Timestamps are UTC in the database; the gym's own timezone is what a member or
 * a staff member means by "today" (CLAUDE.md rule 7). The zone is always passed
 * in from `gyms.timezone` and never hardcoded.
 */
export function formatInGymZone(value: string | Date, timeZone: string, pattern = 'd MMM yyyy'): string {
  return formatInTimeZone(value, timeZone, pattern);
}

export function formatDateTimeInGymZone(value: string | Date, timeZone: string): string {
  return formatInTimeZone(value, timeZone, "d MMM yyyy, h:mm a");
}

/**
 * docs/04 §3: never render a full phone number in a list or a log.
 *
 * Since D-021 a member may have signed up with Google and have no phone at all,
 * so this has to say "none" rather than render "•••" and imply one exists.
 */
export function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length < 6) return '•••';
  return `${phone.slice(0, 3)}•••••${phone.slice(-5)}`;
}

/**
 * Same treatment for an email. The local part is the identifying half, so it is
 * the half that gets masked; the domain is left readable because it is what
 * makes the row recognisable to staff at a glance.
 */
export function maskEmail(email: string | null): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '•••';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

/** What to show staff as the member's contact, whichever provider they used. */
export function maskedContact(phone: string | null, email: string | null): string {
  return phone ? maskPhone(phone) : maskEmail(email);
}
