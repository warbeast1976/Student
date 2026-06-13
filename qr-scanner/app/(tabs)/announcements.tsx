import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppIcon } from '@/components/ui/app-icon';
import { Motion, Radii, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useResponsiveContent } from '@/hooks/use-responsive-content';
import { useThemeColor } from '@/hooks/use-theme-color';
import { apiFetch, postJson } from '@/lib/api-client';
import { paginatedItems } from '@/lib/pagination';

type AnnouncementRow = {
  id: number;
  title?: string;
  body?: string;
  status?: string;
  published_at?: string | null;
  school_class?: { class_name?: string; section?: string };
};

export default function AnnouncementsScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { horizontalPadding, contentShell } = useResponsiveContent();
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [listError, setListError] = useState('');
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');

  const listQuery = useQuery({
    queryKey: ['announcements-list', user?.id, user?.role],
    enabled: Boolean(token && user && user.role !== 'admin'),
    queryFn: async () => {
      const endpoint = user?.role === 'teacher' ? '/api/teacher/announcements' : '/api/student/announcements';
      const payload = await apiFetch<{ data?: unknown; read_ids?: number[] }>(endpoint, { token });
      const items = paginatedItems<AnnouncementRow>(payload);
      const readIds = user?.role === 'student' ? (payload?.read_ids ?? []) : [];
      return { items, readIds };
    },
  });

  const invalidateRelated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['announcements-count'] });
    void queryClient.invalidateQueries({ queryKey: ['announcements-list'] });
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    setListError('');
    try {
      await queryClient.refetchQueries({ queryKey: ['announcements-list', user?.id, user?.role] });
      invalidateRelated();
    } finally {
      setPullRefreshing(false);
    }
  }, [invalidateRelated, queryClient, user?.id, user?.role]);

  const markRead = async (id: number) => {
    if (!token || user?.role !== 'student') return;
    setMarkingId(id);
    setListError('');
    try {
      await postJson(`/api/student/announcements/${id}/read`, {}, token);
      await listQuery.refetch();
      invalidateRelated();
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Unable to mark read.');
    } finally {
      setMarkingId(null);
    }
  };

  if (user?.role === 'admin') {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: background }]}>
        <ThemedText type="title">Announcements</ThemedText>
        <ThemedText style={{ color: muted }}>Use the web portal for admin announcements.</ThemedText>
      </ThemedView>
    );
  }

  const rows = listQuery.data?.items ?? [];
  const readIds = new Set(listQuery.data?.readIds ?? []);

  const listPadding = {
    paddingHorizontal: horizontalPadding,
    paddingBottom: Math.max(insets.bottom, Spacing.lg),
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor: background }]}>
      <View style={[{ flex: 1 }, contentShell]}>
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: Spacing.md, gap: Spacing.sm }}>
        <Animated.View entering={FadeInDown.duration(Motion.enterMedium)}>
          <ThemedView style={[styles.headerCard, { borderColor: border, backgroundColor: surface }]}>
            <ThemedText type="eyebrow" style={[styles.eyebrow, { color: muted }]}>
              Class feed
            </ThemedText>
            <ThemedText type="title">Announcements</ThemedText>
            <ThemedText style={[styles.subtitle, { color: muted }]}>
              {user?.role === 'teacher'
                ? 'Draft and published posts for your classes.'
                : 'Published posts from your class adviser.'}
            </ThemedText>
          </ThemedView>
        </Animated.View>

        {!!listError && (
          <ThemedText style={styles.inlineError} accessibilityLiveRegion="polite">
            {listError}
          </ThemedText>
        )}
      </View>

      {listQuery.isLoading ? (
        <View style={[styles.center, { backgroundColor: surface, marginHorizontal: horizontalPadding }]}>
          <ActivityIndicator color={tint} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} tintColor={tint} />}
          contentContainerStyle={[styles.listContent, listPadding]}
          ListEmptyComponent={
            <ThemedText style={{ color: muted, textAlign: 'center', padding: 24 }}>No announcements yet.</ThemedText>
          }
          renderItem={({ item }) => {
            const isUnread = user?.role === 'student' && !readIds.has(item.id);
            const status = String(item.status ?? (item.published_at ? 'published' : 'draft')).toLowerCase();
            return (
              <View style={[styles.row, { borderColor: border, backgroundColor: surface }]}>
                <View style={styles.rowTop}>
                  <AppIcon name="bell" size={18} color={tint} />
                  <ThemedText type="defaultSemiBold" style={styles.rowTitle} numberOfLines={2}>
                    {item.title ?? `Announcement #${item.id}`}
                  </ThemedText>
                  {isUnread && (
                    <View style={[styles.badge, { backgroundColor: tint }]}>
                      <ThemedText style={styles.badgeText}>New</ThemedText>
                    </View>
                  )}
                </View>
                {!!item.school_class?.class_name && (
                  <ThemedText style={[styles.meta, { color: muted }]}>
                    {item.school_class.class_name}
                    {item.school_class.section ? ` · ${item.school_class.section}` : ''}
                  </ThemedText>
                )}
                {user?.role === 'teacher' && (
                  <ThemedText style={[styles.meta, { color: muted }]}>Status: {status}</ThemedText>
                )}
                {!!item.body && (
                  <ThemedText style={styles.body} numberOfLines={6}>
                    {item.body}
                  </ThemedText>
                )}
                {user?.role === 'student' && item.published_at && isUnread && (
                  <AnimatedPressable
                    style={[styles.markBtn, { borderColor: tint }]}
                    onPress={() => markRead(item.id)}
                    disabled={markingId === item.id}>
                    <ThemedText style={{ color: tint, fontWeight: '700' }}>
                      {markingId === item.id ? 'Saving…' : 'Mark as read'}
                    </ThemedText>
                  </AnimatedPressable>
                )}
              </View>
            );
          }}
        />
      )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  inlineError: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  eyebrow: {
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  row: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
  },
  meta: {
    fontSize: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  markBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.lg,
  },
});
