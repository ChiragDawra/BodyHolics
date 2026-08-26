import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Caption, Card, Heading, Screen } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { useCreateOrder } from '@/features/payments/hooks';

/**
 * D-009 — online checkout goes through Razorpay's hosted flow; counter payment
 * produces a QR the staff scan. Either way the order is created server-side
 * first, so there is a row to settle against before any money moves.
 */
export default function PaymentMethodScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [error, setError] = useState<string | null>(null);
  const createOrder = useCreateOrder();

  function start(method: 'ONLINE' | 'CASH_COUNTER') {
    setError(null);
    createOrder.mutate(
      // One key per attempt. Reusing it on a retry returns the original order
      // rather than opening a second one.
      { planId, method, idempotencyKey: globalThis.crypto.randomUUID() },
      {
        onSuccess: (order) =>
          router.replace(
            method === 'ONLINE'
              ? `/payments/checkout?paymentId=${order.paymentId}`
              : `/payments/counter-qr?paymentId=${order.paymentId}`,
          ),
        onError: (mutationError: Error) => setError(mutationError.message),
      },
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
          <Heading>How would you like to pay?</Heading>
          <Caption>Your membership starts once the payment is confirmed.</Caption>
        </View>

        <Card>
          <Body>Pay online</Body>
          <Caption style={{ marginTop: spacing.xs }}>UPI, card or netbanking.</Caption>
          <Button
            title="Pay online"
            style={{ marginTop: spacing.lg }}
            onPress={() => start('ONLINE')}
            loading={createOrder.isPending}
          />
        </Card>

        <Card>
          <Body>Pay at the counter</Body>
          <Caption style={{ marginTop: spacing.xs }}>
            Show a code at the front desk and pay by cash or UPI.
          </Caption>
          <Button
            title="Pay at the counter"
            variant="secondary"
            style={{ marginTop: spacing.lg }}
            onPress={() => start('CASH_COUNTER')}
            loading={createOrder.isPending}
          />
        </Card>

        {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}
      </ScrollView>
    </Screen>
  );
}
