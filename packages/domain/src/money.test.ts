import { describe, expect, it } from 'vitest';
import { MoneyError, PAISE_PER_RUPEE, formatPaise, parseRupees, sumPaise } from './money';

describe('money (CLAUDE.md rule 6 — integer paise)', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatPaise(150_000)).toBe('₹1,500');
    expect(formatPaise(0)).toBe('₹0');
  });

  it('shows decimals only when there are paise', () => {
    expect(formatPaise(150_050)).toBe('₹1,500.50');
    expect(formatPaise(1)).toBe('₹0.01');
    expect(formatPaise(150_000, { showDecimals: true })).toBe('₹1,500.00');
    expect(formatPaise(150_050, { showDecimals: false })).toBe('₹1,500');
  });

  it('groups in the Indian lakh/crore style, not 3,3,3', () => {
    expect(formatPaise(10_000_000)).toBe('₹1,00,000');
    expect(formatPaise(1_000_000_000)).toBe('₹1,00,00,000');
  });

  it('formats a negative amount (a refund) with the sign outside the symbol', () => {
    expect(formatPaise(-150_050)).toBe('-₹1,500.50');
  });

  it('refuses a non-integer amount instead of rounding it', () => {
    expect(() => formatPaise(1500.5)).toThrow(MoneyError);
    expect(() => sumPaise([100, 0.5])).toThrow(MoneyError);
  });

  it('parses admin-typed rupee strings into paise', () => {
    expect(parseRupees('1500')).toBe(150_000);
    expect(parseRupees('₹1,500.50')).toBe(150_050);
    expect(parseRupees(' 1500.5 ')).toBe(150_050);
    expect(parseRupees('-20')).toBe(-2_000);
    expect(parseRupees('0.01')).toBe(1);
  });

  it('rejects sub-paise precision and junk rather than silently truncating', () => {
    expect(() => parseRupees('1500.555')).toThrow(MoneyError);
    expect(() => parseRupees('abc')).toThrow(MoneyError);
    expect(() => parseRupees('')).toThrow(MoneyError);
  });

  it('round-trips through parse and format', () => {
    for (const value of ['1500', '1500.50', '0.01', '99999.99']) {
      expect(parseRupees(formatPaise(parseRupees(value), { showDecimals: true }))).toBe(
        parseRupees(value),
      );
    }
  });

  it('sums exactly — no floating-point drift', () => {
    expect(sumPaise([1, 2, 3])).toBe(6);
    expect(sumPaise([])).toBe(0);
    expect(PAISE_PER_RUPEE).toBe(100);
  });
});
