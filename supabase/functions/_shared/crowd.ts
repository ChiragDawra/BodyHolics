// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/crowd.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// D-008 — crowd level is a bucketed label, never a public headcount.
// Below `MIN_SAMPLE_SIZE` the honest answer is INSUFFICIENT_DATA, which the UI
// renders as "Not enough data right now" — never as "Not crowded".

export const CROWD_LEVELS = [
  'INSUFFICIENT_DATA',
  'QUIET',
  'MODERATE',
  'CROWDED',
  'VERY_CROWDED',
] as const;
export type CrowdLevel = (typeof CROWD_LEVELS)[number];

/** Occupancy counts at which each band begins (`gyms.crowd_thresholds`). */
export interface CrowdThresholds {
  moderate: number;
  crowded: number;
  veryCrowded: number;
}

/** Fewer signals than this and we say so rather than guessing (D-008). */
export const MIN_SAMPLE_SIZE = 3;

export const CROWD_LEVEL_LABELS: Record<CrowdLevel, string> = {
  INSUFFICIENT_DATA: 'Not enough data right now',
  QUIET: 'Quiet',
  MODERATE: 'Moderate',
  CROWDED: 'Crowded',
  VERY_CROWDED: 'Very crowded',
};

export function crowdLevel(
  occupancy: number,
  thresholds: CrowdThresholds,
  sampleSize: number = occupancy,
): CrowdLevel {
  if (sampleSize < MIN_SAMPLE_SIZE) return 'INSUFFICIENT_DATA';
  if (occupancy >= thresholds.veryCrowded) return 'VERY_CROWDED';
  if (occupancy >= thresholds.crowded) return 'CROWDED';
  if (occupancy >= thresholds.moderate) return 'MODERATE';
  return 'QUIET';
}

/**
 * Accessibility: crowd level is never conveyed by colour alone (docs/01 §7),
 * so every consumer gets a text label alongside the token.
 */
export function crowdLabel(level: CrowdLevel): string {
  return CROWD_LEVEL_LABELS[level];
}
