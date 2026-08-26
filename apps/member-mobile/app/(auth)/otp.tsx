import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Body, Button, Caption, Heading, Screen } from '@/components/ui';
import { spacing, radius, fontSize, useTheme } from '@/theme';
import { verifyOtp } from '@/features/auth/api';
import { otpSchema } from '@/features/auth/schemas';

/** docs/04 §3 — never log the OTP, and never render the full number back. */
function maskPhone(phone: string): string {
  return phone.length < 6 ? '•••' : `${phone.slice(0, 3)}•••••${phone.slice(-4)}`;
}

export default function OtpScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { phone, gymSlug } = useLocalSearchParams<{ phone: string; gymSlug: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: () => verifyOtp(phone, code),
    // A verified session is not yet a membership. Registration finishes in
    // onboarding, where create-member-profile writes the gym_members row.
    onSuccess: () => router.replace(`/(onboarding)/profile?gymSlug=${gymSlug}`),
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function onSubmit() {
    setError(null);
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code.');
      return;
    }
    verify.mutate();
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: spacing.lg, paddingTop: insets.top + spacing['2xl'], gap: spacing.lg }}
      >
        <View style={{ gap: spacing.xs }}>
          <Heading>Enter the code</Heading>
          <Caption>Sent to {maskPhone(phone ?? '')}</Caption>
        </View>

        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          accessibilityLabel="Six digit code"
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            minHeight: 52,
            color: theme.text,
            fontSize: fontSize['2xl'],
            letterSpacing: 8,
          }}
        />

        {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}

        <Button title="Verify" onPress={onSubmit} loading={verify.isPending} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
