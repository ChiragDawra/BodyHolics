import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Body, Button, Caption, Card, Heading, Loading, Screen } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { formatPaise } from '@/lib/format';
import { useCounterToken, usePaymentStatus } from '@/features/payments/hooks';

/**
 * The QR a member shows at the counter.
 *
 * docs/04 §11 — the payload is the raw token string and nothing else. No JSON,
 * no member data, no URL: a QR is photographed, shared and left on screens, so
 * whatever is in it should be worthless the moment it is spent.
 *
 * The token lives 120 seconds. It is refreshed at 100 so there is always a live
 * one on screen, and the screen stops refreshing once the payment settles.
 */
const REFRESH_MS = 100_000;

export default function CounterQrScreen() {
  const theme = useTheme();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mint = useCounterToken();
  const status = usePaymentStatus(paymentId ?? null);
  const settled = status.data?.status === 'PAID';

  useEffect(() => {
    if (!paymentId || settled) return;

    let active = true;
    const issue = () =>
      mint.mutate(paymentId, {
        onSuccess: (result) => {
          if (active) setToken(result.token);
        },
        onError: (mutationError: Error) => {
          if (active) setError(mutationError.message);
        },
      });

    issue();
    const timer = setInterval(issue, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
      // Leaving the screen drops the token from memory. It stays valid until it
      // expires server-side, which is what the short TTL is for.
      setToken(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, settled]);

  if (settled) {
    return (
      <Screen>
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg, justifyContent: 'center' }}>
          <Heading>Payment received</Heading>
          <Body muted>
            Your membership is active
            {status.data?.membership?.endAt ? ' — see Home for the details.' : '.'}
          </Body>
          <Button title="Done" onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Heading>Show this at the counter</Heading>
          <Caption>
            {status.data ? `${formatPaise(status.data.amountPaise)} due` : 'Loading amount…'}
          </Caption>
        </View>

        <Card style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
          {token ? (
            // White quiet zone regardless of theme: scanners need the contrast,
            // and a dark-mode QR on a dark card does not read reliably.
            <View style={{ backgroundColor: '#FFFFFF', padding: spacing.lg, borderRadius: 12 }}>
              <QRCode value={token} size={220} backgroundColor="#FFFFFF" color="#000000" />
            </View>
          ) : (
            <Loading />
          )}
          <Caption style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            The code refreshes automatically. Staff will scan it to confirm your payment.
          </Caption>
        </Card>

        {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}
      </View>
    </Screen>
  );
}
