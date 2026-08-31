/**
 * Client-side PIN check for the /check lock screen.
 *
 * This exists only so the shake fires instantly, without a network round trip.
 * It is NOT the security boundary. Every /check read and write goes through a
 * SECURITY DEFINER Postgres function that re-verifies the PIN against a bcrypt
 * hash in the gym_secrets table, which no browser can read.
 *
 * To stop trusting the client entirely, delete this file and let the RPC's
 * `invalid_pin` error drive the shake instead — the server already rejects a
 * wrong PIN today.
 */
export const PIN_LENGTH = 4;

const DEMO_PIN = "1234";

export function isPinLocallyValid(pin: string): boolean {
  return pin === DEMO_PIN;
}
