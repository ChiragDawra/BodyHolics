import { View } from 'react-native';
import { Body, Caption } from '@/components/ui';
import { useTheme, spacing, radius, fontSize } from '@/theme';
import type { GymStatus } from '../types';

/**
 * D-007 — a manual override wins over the schedule, and when there is one the
 * reason is what the member actually needs ("closed for maintenance" beats
 * "closed").
 */
export function StatusPill({ status, formatTime }: { status: GymStatus | undefined; formatTime: (iso: string) => string }) {
  const theme = useTheme();
  if (!status) return null;

  const open = status.status === 'OPEN';

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radius.full,
            backgroundColor: open ? theme.accent : theme.textMuted,
          }}
        />
        <Body style={{ fontSize: fontSize.sm }}>{open ? 'Open now' : 'Closed'}</Body>
      </View>

      {status.overrideReason ? (
        <Caption>{status.overrideReason}</Caption>
      ) : status.changesAt ? (
        <Caption>
          {open ? 'Closes' : 'Opens'} at {formatTime(status.changesAt)}
        </Caption>
      ) : null}
    </View>
  );
}
