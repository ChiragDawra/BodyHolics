import { ScrollView, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { Body, Button, Caption, Card, Heading, Screen } from '@/components/ui';
import { spacing, fontWeight, useTheme } from '@/theme';
import { formatPaise, formatInGymZone } from '@/lib/format';

/** docs/04 §3 — never render a member's full number back to them in plain text. */
function maskPhone(phone: string): string {
  return phone.length < 6 ? '•••' : `${phone.slice(0, 3)}•••••${phone.slice(-4)}`;
}

export default function MeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, gymId, memberCode, signOut } = useAuth();

  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      // Explicit columns, not `select *`.
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId!)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const payments = useQuery({
    queryKey: ['my-payments', gymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('payments')
        .select('id, amount_paise, status, paid_at, created_at, method')
        .eq('gym_id', gymId!)
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: Boolean(gymId),
    staleTime: 60_000,
  });

  const gym = useQuery({
    queryKey: ['gym', gymId],
    queryFn: async () => {
      const { data } = await supabase.from('gyms').select('timezone').eq('id', gymId!).maybeSingle();
      return data;
    },
    enabled: Boolean(gymId),
    staleTime: 60 * 60_000,
  });

  const timeZone = gym.data?.timezone ?? 'Asia/Kolkata';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing['3xl'],
          gap: spacing.lg,
        }}
      >
        <Heading>Me</Heading>

        <Card>
          <Body style={{ fontWeight: fontWeight.semibold }}>{profile.data?.full_name ?? '—'}</Body>
          <Caption style={{ marginTop: spacing.xs }}>
            {profile.data?.phone ? maskPhone(profile.data.phone) : '—'}
            {memberCode ? ` · ${memberCode}` : ''}
          </Caption>
        </Card>

        <Pressable accessibilityRole="button" onPress={() => router.push('/issues')}>
          <Card>
            <Body>Report a problem</Body>
            <Caption style={{ marginTop: spacing.xs }}>
              Equipment, cleanliness, billing — the gym will see it and reply.
            </Caption>
          </Card>
        </Pressable>

        <Card>
          <Caption style={{ marginBottom: spacing.md }}>Payment history</Caption>
          {(payments.data ?? []).length === 0 ? (
            <Caption>No payments yet.</Caption>
          ) : (
            (payments.data ?? []).map((payment) => (
              <View
                key={payment.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                }}
              >
                <View>
                  <Body>{formatPaise(payment.amount_paise)}</Body>
                  <Caption>
                    {formatInGymZone(payment.paid_at ?? payment.created_at, timeZone)}
                  </Caption>
                </View>
                <Caption
                  style={{ color: payment.status === 'PAID' ? theme.accent : theme.textMuted }}
                >
                  {payment.status.toLowerCase()}
                </Caption>
              </View>
            ))
          )}
        </Card>

        <Button
          title="Sign out"
          variant="secondary"
          onPress={() => {
            void signOut().then(() => router.replace('/(auth)/scan'));
          }}
        />
      </ScrollView>
    </Screen>
  );
}
