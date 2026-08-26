import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { createMemberProfileSchema } from '@gym/validation';
import { Body, Button, Caption, Heading, Screen } from '@/components/ui';
import { spacing, radius, fontSize, useTheme } from '@/theme';
import { createMemberProfile } from '@/features/auth/api';
import { useAuth } from '@/providers/auth-provider';

/**
 * Finishes registration. Note what this form does not ask for: the phone number.
 * It is already on the JWT, and the server reads it from there — a form field
 * would be a claim anyone could type (docs/07 §3).
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gymSlug } = useLocalSearchParams<{ gymSlug: string }>();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createMemberProfile,
    onSuccess: async () => {
      await refresh();
      router.replace('/(onboarding)/plans');
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  function onSubmit() {
    setError(null);
    // The same schema the Edge Function parses with, so the two cannot disagree
    // about what a valid name is (D-012).
    const parsed = createMemberProfileSchema.safeParse({ gymSlug, fullName });

    if (!parsed.success) {
      setError('Enter your name as it should appear at the gym.');
      return;
    }
    create.mutate(parsed.data);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: spacing.lg, paddingTop: insets.top + spacing['2xl'], gap: spacing.lg }}
      >
        <View style={{ gap: spacing.xs }}>
          <Heading>What should we call you?</Heading>
          <Caption>This is the name the gym sees at the counter.</Caption>
        </View>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
          maxLength={120}
          autoFocus
          placeholder="Your full name"
          placeholderTextColor={theme.textMuted}
          accessibilityLabel="Full name"
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            minHeight: 52,
            color: theme.text,
            fontSize: fontSize.lg,
          }}
        />

        {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}

        <Button title="Continue" onPress={onSubmit} loading={create.isPending} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
