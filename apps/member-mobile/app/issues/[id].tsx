import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge, Body, Button, Caption, Heading, Loading, Screen } from '@/components/ui';
import { spacing, radius, fontSize, useTheme } from '@/theme';
import { useReplyToIssue } from '@/features/issues/hooks';

const LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'Owner reviewing',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
} as const;

export default function IssueDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reply = useReplyToIssue();

  const issue = useQuery({
    queryKey: ['issue', id],
    queryFn: async () => {
      // RLS scopes this to the member's own issue; another member's id simply
      // returns nothing.
      const [{ data: row }, { data: messages }] = await Promise.all([
        supabase
          .from('issues')
          .select('id, title, description, category, status, created_at')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('issue_messages')
          .select('id, author_role, body, created_at')
          .eq('issue_id', id)
          .order('created_at', { ascending: true }),
      ]);
      return { row, messages: messages ?? [] };
    },
    enabled: Boolean(id),
  });

  if (issue.isLoading) return <Screen><Loading /></Screen>;
  if (!issue.data?.row) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg }}>
          <Body muted>That report is no longer available.</Body>
        </View>
      </Screen>
    );
  }

  const record = issue.data.row;
  const closed = record.status === 'CLOSED';

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Heading>{record.title}</Heading>
            <Badge
              label={LABEL[record.status as keyof typeof LABEL]}
              tone={record.status === 'RESOLVED' ? 'positive' : closed ? 'neutral' : 'warning'}
            />
          </View>

          <View
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: spacing.lg,
            }}
          >
            <Caption>You wrote</Caption>
            <Body style={{ marginTop: spacing.xs }}>{record.description}</Body>
          </View>

          {issue.data.messages.map((message) => (
            <View
              key={message.id}
              style={{
                backgroundColor: message.author_role === 'STAFF' ? theme.surfaceRaised : theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginLeft: message.author_role === 'STAFF' ? 0 : spacing.xl,
                marginRight: message.author_role === 'STAFF' ? spacing.xl : 0,
              }}
            >
              <Caption>{message.author_role === 'STAFF' ? 'The gym' : 'You'}</Caption>
              <Body style={{ marginTop: spacing.xs }}>{message.body}</Body>
            </View>
          ))}

          {closed ? (
            <Caption>
              This report is closed. If it happens again, please raise a new one.
            </Caption>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <TextInput
                value={body}
                onChangeText={setBody}
                maxLength={2000}
                multiline
                placeholder="Add a reply"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Reply"
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: theme.text,
                  fontSize: fontSize.base,
                  minHeight: 90,
                  textAlignVertical: 'top',
                }}
              />
              {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}
              <Button
                title="Send reply"
                loading={reply.isPending}
                onPress={() => {
                  setError(null);
                  reply.mutate(
                    { issueId: record.id, body },
                    {
                      onSuccess: () => {
                        setBody('');
                        void issue.refetch();
                      },
                      onError: (mutationError: Error) => setError(mutationError.message),
                    },
                  );
                }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
