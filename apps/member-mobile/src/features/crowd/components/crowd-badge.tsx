import { View } from 'react-native';
import { crowdColors } from '@gym/ui';
import { Body, Caption } from '@/components/ui';
import { spacing, radius, fontSize } from '@/theme';
import type { Crowd } from '../types';

const LABELS: Record<string, string> = {
  NOT_CROWDED: 'Quiet',
  MODERATE: 'Moderate',
  CROWDED: 'Busy',
  VERY_CROWDED: 'Very busy',
};

/**
 * D-008 — below three people there is not enough signal to say anything, and an
 * unknown gym is not a quiet gym. Saying "not enough data" is more honest than
 * showing "Quiet" and being wrong when someone drives over.
 */
export function CrowdBadge({ crowd }: { crowd: Crowd | undefined }) {
  const insufficient = !crowd || crowd.confidence === 'INSUFFICIENT_DATA' || !crowd.level;
  const color = insufficient ? crowdColors.INSUFFICIENT_DATA : crowdColors[crowd.level!];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: color }} />
      {insufficient ? (
        <Caption>Not enough data right now</Caption>
      ) : (
        <Body style={{ fontSize: fontSize.sm }}>{LABELS[crowd.level!]}</Body>
      )}
    </View>
  );
}
