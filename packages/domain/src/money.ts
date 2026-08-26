// CLAUDE.md rule 6 — money is integer paise end to end. Formatting happens
// only at render, and only here.

/** ₹1 = 100 paise. */
export const PAISE_PER_RUPEE = 100;

export class MoneyError extends Error {}

function assertPaise(paise: number): void {
  if (!Number.isInteger(paise)) {
    throw new MoneyError(`Money must be integer paise, received ${paise}`);
  }
}

/**
 * Renders paise as INR for display. Never use the result for arithmetic.
 *
 * `formatPaise(150000)` → `"₹1,500"`, `formatPaise(150050)` → `"₹1,500.50"`.
 */
export function formatPaise(paise: number, options: { showDecimals?: boolean } = {}): string {
  assertPaise(paise);
  const showDecimals = options.showDecimals ?? paise % PAISE_PER_RUPEE !== 0;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;

  // en-IN grouping is 2,2,3 (lakh/crore), not 3,3,3.
  const grouped = rupees.toLocaleString('en-IN');
  const body = showDecimals ? `${grouped}.${String(remainder).padStart(2, '0')}` : grouped;
  return `${negative ? '-' : ''}₹${body}`;
}

/**
 * Parses a rupee string typed by an admin into integer paise.
 * Rejects anything with sub-paise precision rather than silently rounding.
 */
export function parseRupees(input: string): number {
  const cleaned = input.trim().replace(/[₹,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new MoneyError(`Not a valid rupee amount: ${input}`);
  }
  const negative = cleaned.startsWith('-');
  const [whole = '0', fraction = ''] = cleaned.replace('-', '').split('.');
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(fraction.padEnd(2, '0'));
  return negative ? -paise : paise;
}

export function sumPaise(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    assertPaise(amount);
    total += amount;
  }
  return total;
}
