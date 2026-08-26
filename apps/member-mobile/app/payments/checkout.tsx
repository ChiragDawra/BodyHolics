import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Caption, Heading, Loading, Screen } from '@/components/ui';
import { spacing } from '@/theme';
import { formatPaise } from '@/lib/format';
import { usePaymentStatus } from '@/features/payments/hooks';

/**
 * Waits for an online payment to settle.
 *
 * This screen does not decide anything. The membership becomes ACTIVE when the
 * Razorpay webhook says the money was captured, and this polls `payment-status`
 * to find out — a client-reported success would be a client deciding it had
 * paid (CLAUDE.md rule 1).
 *
 * docs/03 §7 — Expo Go cannot run react-native-razorpay, so checkout is the
 * hosted redirect flow rather than the native SDK.
 */
export default function CheckoutScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const status = usePaymentStatus(paymentId ?? null);

  useEffect(() => {
    if (status.data?.status === 'PAID') {
      const timer = setTimeout(() => router.replace('/(tabs)'), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status.data?.status]);

  if (!status.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { status: state, amountPaise } = status.data;

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg, justifyContent: 'center' }}>
        {state === 'PAID' ? (
          <>
            <Heading>Payment received</Heading>
            <Body muted>Your membership is active.</Body>
          </>
        ) : state === 'FAILED' || state === 'CANCELLED' ? (
          <>
            <Heading>Payment did not go through</Heading>
            <Body muted>Nothing has been charged. You can try again from Home.</Body>
            <Button title="Back to Home" onPress={() => router.replace('/(tabs)')} />
          </>
        ) : (
          <>
            <Heading>Waiting for confirmation</Heading>
            <Caption>
              {formatPaise(amountPaise)} · this usually takes a few seconds.
            </Caption>
            <Loading />
            <Body muted style={{ textAlign: 'center' }}>
              You can close this screen — we will update your membership as soon as the payment
              clears.
            </Body>
          </>
        )}
      </View>
    </Screen>
  );
}
