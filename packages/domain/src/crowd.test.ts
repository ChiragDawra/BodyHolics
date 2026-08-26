import { describe, expect, it } from 'vitest';
import { CROWD_LEVEL_LABELS, MIN_SAMPLE_SIZE, crowdLabel, crowdLevel } from './crowd';

const thresholds = { moderate: 10, crowded: 25, veryCrowded: 40 };

describe('crowd bucketing (D-008)', () => {
  it('buckets occupancy into the four bands', () => {
    expect(crowdLevel(3, thresholds)).toBe('QUIET');
    expect(crowdLevel(9, thresholds)).toBe('QUIET');
    expect(crowdLevel(10, thresholds)).toBe('MODERATE');
    expect(crowdLevel(24, thresholds)).toBe('MODERATE');
    expect(crowdLevel(25, thresholds)).toBe('CROWDED');
    expect(crowdLevel(39, thresholds)).toBe('CROWDED');
    expect(crowdLevel(40, thresholds)).toBe('VERY_CROWDED');
    expect(crowdLevel(400, thresholds)).toBe('VERY_CROWDED');
  });

  it('says INSUFFICIENT_DATA below the sample floor rather than "Quiet"', () => {
    expect(MIN_SAMPLE_SIZE).toBe(3);
    expect(crowdLevel(0, thresholds)).toBe('INSUFFICIENT_DATA');
    expect(crowdLevel(2, thresholds)).toBe('INSUFFICIENT_DATA');
    expect(crowdLevel(3, thresholds)).toBe('QUIET');
  });

  it('honours an explicit sample size distinct from occupancy', () => {
    // A high occupancy backed by too few signals is still not reportable.
    expect(crowdLevel(50, thresholds, 1)).toBe('INSUFFICIENT_DATA');
    expect(crowdLevel(50, thresholds, 3)).toBe('VERY_CROWDED');
  });

  it('never renders INSUFFICIENT_DATA as an absence of crowding', () => {
    expect(crowdLabel('INSUFFICIENT_DATA')).toBe('Not enough data right now');
    expect(crowdLabel('INSUFFICIENT_DATA')).not.toMatch(/not crowded/i);
  });

  it('gives every level a text label, so colour is never the only signal', () => {
    for (const [level, label] of Object.entries(CROWD_LEVEL_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(crowdLabel(level as keyof typeof CROWD_LEVEL_LABELS)).toBe(label);
    }
  });
});
