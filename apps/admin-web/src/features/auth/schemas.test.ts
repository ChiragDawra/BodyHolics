import { describe, expect, it } from 'vitest';
import { resolveLoginEmail, staffLoginSchema } from './schemas';

/**
 * These cover the one thing that turns a typed username into the address
 * Supabase is asked about. Get it wrong and the owner's credential silently
 * stops matching an account — a failure that looks exactly like a wrong
 * password, which is the hardest kind to diagnose from a support call.
 */
describe('resolveLoginEmail', () => {
  it('completes a bare username with the configured domain', () => {
    expect(resolveLoginEmail('ChiragDawra')).toBe('chiragdawra@staff.bodyholics.app');
  });

  it('is case-insensitive, which is the point of accepting a username', () => {
    expect(resolveLoginEmail('CHIRAGDAWRA')).toBe(resolveLoginEmail('chiragdawra'));
  });

  it('tolerates the spaces a phone keyboard adds', () => {
    expect(resolveLoginEmail('  ChiragDawra  ')).toBe('chiragdawra@staff.bodyholics.app');
  });

  it('passes a full address through untouched', () => {
    expect(resolveLoginEmail('owner@bodyholics.in')).toBe('owner@bodyholics.in');
  });

  it('does not lower-case an address, because the local part is case-sensitive', () => {
    // RFC 5321 makes the mailbox part case-sensitive, and Supabase compares what
    // it is given. Folding it here would break an account that legitimately has
    // capitals in it.
    expect(resolveLoginEmail('Owner@BodyHolics.in')).toBe('Owner@BodyHolics.in');
  });
});

describe('staffLoginSchema', () => {
  it('accepts a username and a password', () => {
    const result = staffLoginSchema.safeParse({ identifier: 'ChiragDawra', password: '12345678' });
    expect(result.success).toBe(true);
  });

  it('rejects a password below the minimum length', () => {
    const result = staffLoginSchema.safeParse({ identifier: 'ChiragDawra', password: '1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty identifier', () => {
    const result = staffLoginSchema.safeParse({ identifier: '   ', password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('rejects an extra field rather than ignoring it', () => {
    const result = staffLoginSchema.safeParse({
      identifier: 'ChiragDawra',
      password: '12345678',
      role: 'OWNER',
    });
    expect(result.success).toBe(false);
  });
});
