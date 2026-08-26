import { FlatList, Pressable, View } from 'react-native';
import { Body, Caption, EmptyState, Loading, Screen } from '@/components/ui';
import { spacing, fontWeight, useTheme } from '@/theme';
import { useMarkRead, useNotifications } from '@/features/alerts/hooks';

/**
 * Alerts. Reached from the bell on Home — a stack screen, not a fourth tab
 * (CLAUDE.md rule 8).
 *
 * Tapping marks it read, and `read_at` is the only column a member can write.
 * That is enforced by a column grant, not by this screen only sending one field
 * (docs/05 §8).
 */
export default function AlertsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const markRead = useMarkRead();

  if (notifications.isLoading) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          <EmptyState title="Nothing yet" hint="Gym announcements and updates will appear here." />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.read_at ? item.title : `Unread: ${item.title}`}
            onPress={() => {
              if (!item.read_at) markRead.mutate(item.id);
            }}
          >
            <View
              style={{
                backgroundColor: theme.surface,
                borderColor: item.read_at ? theme.border : theme.accent,
                borderWidth: 1,
                borderRadius: 12,
                padding: spacing.lg,
              }}
            >
              <Body style={{ fontWeight: item.read_at ? fontWeight.regular : fontWeight.semibold }}>
                {item.title}
              </Body>
              <Body muted style={{ marginTop: spacing.xs }}>
                {item.body}
              </Body>
              <Caption style={{ marginTop: spacing.sm }}>
                {item.category.toLowerCase().replace(/_/g, ' ')}
              </Caption>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
