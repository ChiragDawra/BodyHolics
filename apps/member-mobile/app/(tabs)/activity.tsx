import { SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { Body, Caption, EmptyState, Heading, Loading, Screen } from '@/components/ui';
import { spacing, fontWeight } from '@/theme';
import { formatInGymZone, formatTimeInGymZone } from '@/lib/format';

/**
 * Visit history. docs/07 §8 — read directly under RLS; the policy is
 * `user_id = auth.uid()`, so the only rows that exist for this caller are their
 * own visits.
 *
 * Grouping is by *gym-local* date, not by the device's. A late session that ends
 * after midnight UTC still belongs to the evening it happened in.
 */
export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { gymId } = useAuth();

  const gym = useQuery({
    queryKey: ['gym', gymId],
    queryFn: async () => {
      const { data } = await supabase.from('gyms').select('timezone').eq('id', gymId!).maybeSingle();
      return data;
    },
    enabled: Boolean(gymId),
    staleTime: 60 * 60_000,
  });

  const visits = useQuery({
    queryKey: ['attendance', gymId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_events')
        .select('id, occurred_at, event_type')
        .eq('gym_id', gymId!)
        .in('event_type', ['PRESENCE_START', 'CHECK_IN'])
        .order('occurred_at', { ascending: false })
        .limit(200);

      if (error) throw new Error('Could not load your activity.');
      return data ?? [];
    },
    enabled: Boolean(gymId),
    staleTime: 60_000,
  });

  const timeZone = gym.data?.timezone ?? 'Asia/Kolkata';

  if (visits.isLoading) return <Screen><Loading /></Screen>;

  const sections = Object.entries(
    (visits.data ?? []).reduce<Record<string, typeof visits.data>>((acc, visit) => {
      const day = formatInGymZone(visit.occurred_at, timeZone, 'MMMM yyyy');
      (acc[day] ??= []).push(visit);
      return acc;
    }, {}),
  ).map(([title, data]) => ({ title, data: data ?? [] }));

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing['3xl'],
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Heading>Activity</Heading>
            <Caption style={{ marginTop: spacing.xs }}>
              {visits.data?.length ?? 0} visit{visits.data?.length === 1 ? '' : 's'} recorded
            </Caption>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No visits yet"
            hint="Your gym visits will appear here once you start checking in."
          />
        }
        renderSectionHeader={({ section }) => (
          <Caption style={{ marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: fontWeight.medium }}>
            {section.title}
          </Caption>
        )}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: spacing.md,
            }}
          >
            <Body>{formatInGymZone(item.occurred_at, timeZone, 'EEE d MMM')}</Body>
            <Caption>{formatTimeInGymZone(item.occurred_at, timeZone)}</Caption>
          </View>
        )}
      />
    </Screen>
  );
}
