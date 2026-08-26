import { ScrollView, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Caption, Card, Heading, Loading, Screen, ErrorState } from '@/components/ui';
import { spacing, fontWeight, useTheme } from '@/theme';
import { formatPaise } from '@/lib/format';
import { usePlans } from '@/features/membership/hooks';
import { useAuth } from '@/providers/auth-provider';

/**
 * The prices shown here come from `membership_plans`, and the price that is
 * charged is read from that same row on the server. Nothing the client sends
 * decides an amount (CLAUDE.md rule 2), so a tampered display cannot become a
 * tampered charge.
 */
export default function PlansScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gymId } = useAuth();
  const plans = usePlans(gymId);

  if (plans.isLoading) return <Screen><Loading /></Screen>;
  if (plans.isError) {
    return (
      <Screen>
        <ErrorState message="Could not load the plans." onRetry={() => void plans.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing['2xl'],
          gap: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Heading>Choose a plan</Heading>
          <Caption>You can pay online or at the counter.</Caption>
        </View>

        {(plans.data ?? []).map((plan) => (
          <Pressable
            key={plan.id}
            accessibilityRole="button"
            onPress={() => router.push(`/(onboarding)/payment-method?planId=${plan.id}`)}
          >
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Body style={{ fontWeight: fontWeight.semibold }}>{plan.name}</Body>
                <Body style={{ fontWeight: fontWeight.semibold, color: theme.accent }}>
                  {formatPaise(plan.price_paise)}
                </Body>
              </View>
              <Caption style={{ marginTop: spacing.xs }}>
                {plan.duration_days} days{plan.description ? ` · ${plan.description}` : ''}
              </Caption>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
