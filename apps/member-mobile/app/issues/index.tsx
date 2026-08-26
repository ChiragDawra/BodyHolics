import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Body, Button, Caption, EmptyState, Loading, Screen } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { useMyIssues } from '@/features/issues/hooks';

const TONE = {
  OPEN: 'warning',
  IN_PROGRESS: 'warning',
  RESOLVED: 'positive',
  CLOSED: 'neutral',
} as const;

/** D-003 owns the member-facing wording for each status. */
const LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'Owner reviewing',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
} as const;

export default function IssuesScreen() {
  const theme = useTheme();
  const issues = useMyIssues();

  if (issues.isLoading) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <FlatList
        data={issues.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListHeaderComponent={
          <Button
            title="Report something"
            style={{ marginBottom: spacing.md }}
            onPress={() => router.push('/issues/new')}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing reported"
            hint="Tell the gym about equipment, cleanliness or billing and they will reply here."
          />
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/issues/${item.id}`)}>
            <View
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Body>{item.title}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Badge
                  label={LABEL[item.status as keyof typeof LABEL]}
                  tone={TONE[item.status as keyof typeof TONE]}
                />
                <Caption>{item.category.toLowerCase()}</Caption>
              </View>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
