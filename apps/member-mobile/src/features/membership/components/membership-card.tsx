import { View } from 'react-native';
import { Badge, Body, Caption, Card, Heading } from '@/components/ui';
import { spacing } from '@/theme';

type Props = {
  planName: string | null;
  endAt: string | null;
  daysRemaining: number | null;
  isExpiring: boolean;
  formatDate: (iso: string) => string;
};

/**
 * The one thing a member opens the app to check. Presentational only — it is
 * handed a formatter rather than reaching for the gym's timezone itself.
 */
export function MembershipCard({ planName, endAt, daysRemaining, isExpiring, formatDate }: Props) {
  if (!endAt) {
    return (
      <Card>
        <Caption>Membership</Caption>
        <Heading style={{ marginTop: spacing.xs }}>Not active</Heading>
        <Body muted style={{ marginTop: spacing.xs }}>
          Pick a plan to start training.
        </Body>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Caption>{planName ?? 'Membership'}</Caption>
        <Badge
          label={isExpiring ? 'Renewing soon' : 'Active'}
          tone={isExpiring ? 'warning' : 'positive'}
        />
      </View>

      <Heading style={{ marginTop: spacing.sm }}>
        {daysRemaining === 0
          ? 'Ends today'
          : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`}
      </Heading>

      <Body muted style={{ marginTop: spacing.xs }}>
        Valid until {formatDate(endAt)}
      </Body>
    </Card>
  );
}
