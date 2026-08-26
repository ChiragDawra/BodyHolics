import { RefreshControl, ScrollView, View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useTheme, spacing, fontSize, fontWeight } from '@/theme';
import { Body, Button, Caption, Card, Heading, Loading, Screen } from '@/components/ui';
import { formatInGymZone, formatTimeInGymZone } from '@/lib/format';
import { useCurrentMembership, usePendingPayment } from '@/features/membership/hooks';
import { MembershipCard } from '@/features/membership/components/membership-card';
import { useGymStatus } from '@/features/gym-status/hooks';
import { StatusPill } from '@/features/gym-status/components/status-pill';
import { useCrowd } from '@/features/crowd/hooks';
import { CrowdBadge } from '@/features/crowd/components/crowd-badge';
import { useUnreadCount } from '@/features/alerts/hooks';

/**
 * Home. Membership status, whether the gym is open, how busy it is, and anything
 * waiting on the member.
 *
 * The bell is here rather than in the tab bar: alerts are a stack screen, not a
 * fourth tab (CLAUDE.md rule 8).
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gymId, memberCode } = useAuth();

  const gym = useQuery({
    queryKey: ['gym', gymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gyms')
        .select('id, name, timezone')
        .eq('id', gymId!)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(gymId),
    staleTime: 60 * 60_000,
  });

  const membership = useCurrentMembership(gymId);
  const pending = usePendingPayment(gymId);
  const status = useGymStatus(gymId);
  const crowd = useCrowd(gymId);
  const unread = useUnreadCount();

  const timeZone = gym.data?.timezone ?? 'Asia/Kolkata';
  const refreshing = membership.isFetching || status.isFetching || crowd.isFetching;

  if (!gymId || gym.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing['3xl'],
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void membership.refetch();
              void status.refetch();
              void crowd.refetch();
              void pending.refetch();
            }}
            tintColor={theme.textMuted}
          />
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Caption>{gym.data?.name ?? 'Your gym'}</Caption>
            <Heading style={{ marginTop: spacing.xs }}>Home</Heading>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unread.data ? `Alerts, ${unread.data} unread` : 'Alerts'
            }
            onPress={() => router.push('/alerts')}
            hitSlop={12}
            style={{ padding: spacing.sm }}
          >
            <Text style={{ fontSize: 22, color: theme.text }}>◔</Text>
            {unread.data && unread.data > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  backgroundColor: theme.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
                  {unread.data > 9 ? '9+' : unread.data}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <MembershipCard
          planName={null}
          endAt={membership.data?.end_at ?? null}
          daysRemaining={membership.data?.days_remaining ?? null}
          isExpiring={Boolean(membership.data?.is_expiring)}
          formatDate={(iso) => formatInGymZone(iso, timeZone)}
        />

        {/* A pending payment is the most actionable thing on this screen, so it
            sits directly under the membership rather than in a menu. */}
        {pending.data ? (
          <Card style={{ borderColor: theme.warning }}>
            <Caption>Waiting on payment</Caption>
            <Body style={{ marginTop: spacing.xs }}>
              You have a payment that has not completed yet.
            </Body>
            <Button
              title={pending.data.method === 'ONLINE' ? 'Finish paying' : 'Show counter code'}
              style={{ marginTop: spacing.lg }}
              onPress={() =>
                router.push(
                  pending.data!.method === 'ONLINE'
                    ? `/payments/checkout?paymentId=${pending.data!.id}`
                    : `/payments/counter-qr?paymentId=${pending.data!.id}`,
                )
              }
            />
          </Card>
        ) : !membership.data ? (
          <Card>
            <Caption>Get started</Caption>
            <Body style={{ marginTop: spacing.xs }}>Choose a plan to activate your membership.</Body>
            <Button
              title="See plans"
              style={{ marginTop: spacing.lg }}
              onPress={() => router.push('/(onboarding)/plans')}
            />
          </Card>
        ) : null}

        <Card>
          <Caption style={{ marginBottom: spacing.md }}>Right now</Caption>
          <StatusPill status={status.data} formatTime={(iso) => formatTimeInGymZone(iso, timeZone)} />
          <View style={{ height: spacing.md }} />
          <CrowdBadge crowd={crowd.data} />
        </Card>

        {memberCode ? (
          <Card>
            <Caption>Member code</Caption>
            <Heading style={{ marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>
              {memberCode}
            </Heading>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
