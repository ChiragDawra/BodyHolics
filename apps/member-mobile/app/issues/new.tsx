import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { createIssueSchema } from '@gym/validation';
import { Body, Button, Caption, Heading, Screen } from '@/components/ui';
import { spacing, radius, fontSize, useTheme } from '@/theme';
import { useCreateIssue } from '@/features/issues/hooks';

const CATEGORIES = [
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'CLEANLINESS', label: 'Cleanliness' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'OTHER', label: 'Something else' },
] as const;

export default function NewIssueScreen() {
  const theme = useTheme();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('EQUIPMENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useCreateIssue();

  function onSubmit() {
    setError(null);
    // The same schema the Edge Function parses with (D-012), so a value this
    // form accepts is one the server accepts.
    const parsed = createIssueSchema.safeParse({ category, title, description });

    if (!parsed.success) {
      setError('Add a short title and describe what happened.');
      return;
    }

    create.mutate(parsed.data, {
      onSuccess: () => router.replace('/issues'),
      onError: (mutationError: Error) => setError(mutationError.message),
    });
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: theme.text,
    fontSize: fontSize.base,
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <Heading>What happened?</Heading>

          <View style={{ gap: spacing.sm }}>
            <Caption>Category</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CATEGORIES.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category === option.value }}
                  onPress={() => setCategory(option.value)}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: category === option.value ? theme.accent : theme.border,
                    backgroundColor: category === option.value ? theme.surfaceRaised : 'transparent',
                    minHeight: 44,
                    justifyContent: 'center',
                  }}
                >
                  <Body style={{ fontSize: fontSize.sm }}>{option.label}</Body>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Caption>Title</Caption>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="Treadmill 3 belt slipping"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="Title"
              style={inputStyle}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Caption>Details</Caption>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              multiline
              numberOfLines={6}
              placeholder="What did you notice, and when?"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="Details"
              style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
            />
          </View>

          {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}

          <Button title="Send to the gym" onPress={onSubmit} loading={create.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
