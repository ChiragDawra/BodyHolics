import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Body, Button, Caption, Heading, Screen } from '@/components/ui';
import { spacing, radius, fontSize, useTheme } from '@/theme';
import { fetchGymBySlug, requestOtp } from '@/features/auth/api';
import { phoneSchema } from '@/features/auth/schemas';

export default function PhoneScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gymSlug } = useLocalSearchParams<{ gymSlug: string }>();
  const [national, setNational] = useState('');
  const [error, setError] = useState<string | null>(null);

  const gym = useQuery({
    queryKey: ['gym-by-slug', gymSlug],
    queryFn: () => fetchGymBySlug(gymSlug),
    enabled: Boolean(gymSlug),
  });

  const send = useMutation({
    mutationFn: requestOtp,
    onSuccess: (_data, phone) => router.push(`/(auth)/otp?phone=${encodeURIComponent(phone)}&gymSlug=${gymSlug}`),
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function onSubmit() {
    setError(null);
    // Indian numbers are entered nationally and normalised to E.164 here, which
    // is the only format the database accepts.
    const digits = national.replace(/\D/g, '');
    const parsed = phoneSchema.safeParse(digits.startsWith('91') ? `+${digits}` : `+91${digits}`);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number.');
      return;
    }
    send.mutate(parsed.data);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: spacing.lg, paddingTop: insets.top + spacing['2xl'], gap: spacing.lg }}
      >
        <View style={{ gap: spacing.xs }}>
          <Caption>{gym.data?.name ?? 'Urban Gym'}</Caption>
          <Heading>What is your number?</Heading>
          <Body muted>We will text you a six-digit code to sign in.</Body>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            minHeight: 52,
            gap: spacing.sm,
          }}
        >
          <Body>+91</Body>
          <TextInput
            value={national}
            onChangeText={setNational}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={12}
            placeholder="98765 43210"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Phone number"
            style={{ flex: 1, color: theme.text, fontSize: fontSize.lg }}
          />
        </View>

        {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}

        <Button title="Send code" onPress={onSubmit} loading={send.isPending} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
