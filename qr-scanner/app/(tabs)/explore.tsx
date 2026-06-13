import { ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppIcon } from '@/components/ui/app-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiOriginLabel } from '@/constants/api';
import { Motion, Radii, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useResponsiveContent } from '@/hooks/use-responsive-content';
import { useThemeColor } from '@/hooks/use-theme-color';
import { apiFetch } from '@/lib/api-client';
import { paginatedTotal } from '@/lib/pagination';

const roleLabel = (role?: string) => {
  const r = String(role ?? '').toLowerCase();
  if (r === 'admin') return 'Administrator';
  if (r === 'teacher') return 'Teacher';
  return 'Student';
};

export default function TabTwoScreen() {
  const { token, user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { horizontalPadding, contentShell } = useResponsiveContent();

  const announcementsQuery = useQuery({
    queryKey: ['announcements-count', user?.id, user?.role],
    enabled: Boolean(token && user),
    queryFn: async () => {
      const endpoint = user?.role === 'teacher' ? '/api/teacher/announcements' : '/api/student/announcements';
      const payload = await apiFetch<{ data?: unknown }>(endpoint, { token });
      return paginatedTotal(payload);
    },
  });

  const announcementsCount = announcementsQuery.data ?? 0;
  const loading = announcementsQuery.isLoading;
  const appVersion = Constants.expoConfig?.version ?? '—';
  const apiOrigin = getApiOriginLabel();
  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor: background }]}>
      <ScrollView
        contentContainerStyle={[
          contentShell,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: Spacing.md,
            paddingBottom: Math.max(insets.bottom, 28) + Spacing.md,
            gap: Spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(Motion.enterMedium)}>
        <ThemedView style={[styles.titleCard, { borderColor: border, backgroundColor: surface }]}>
          <ThemedText type="eyebrow" style={[styles.eyebrow, { color: muted }]}>
            Account
          </ThemedText>
          <ThemedText type="title">Profile</ThemedText>
          <ThemedText style={[styles.subtitle, { color: muted }]}>Your current signed-in details.</ThemedText>
        </ThemedView>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(70).duration(Motion.enterFast)}>
        <View style={[styles.infoCard, { borderColor: border, backgroundColor: surface }]}>
          <View style={styles.infoItem}>
            <AppIcon name="profile" size={16} color={tint} />
            <ThemedText style={styles.infoKey}>Name</ThemedText>
            <ThemedText style={styles.infoValue}>{user?.displayName}</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <AppIcon name="dashboard" size={16} color={tint} />
            <ThemedText style={styles.infoKey}>Login ID</ThemedText>
            <ThemedText style={styles.infoValue}>{user?.identifier}</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <AppIcon name="class" size={16} color={tint} />
            <ThemedText style={styles.infoKey}>Role</ThemedText>
            <ThemedText style={styles.infoValue}>{roleLabel(user?.role)}</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <AppIcon name="bell" size={16} color={tint} />
            <ThemedText style={styles.infoKey}>Announcements</ThemedText>
            {loading ? <Skeleton height={18} width={80} borderRadius={8} /> : <ThemedText style={styles.infoValue}>{announcementsCount}</ThemedText>}
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(110).duration(Motion.enterFast)}>
        <View style={[styles.infoCard, { borderColor: border, backgroundColor: surface }]}>
          <View style={styles.infoItem}>
            <AppIcon name="dashboard" size={16} color={tint} />
            <ThemedText style={styles.infoKey}>App version</ThemedText>
            <ThemedText style={styles.infoValue}>{appVersion}</ThemedText>
          </View>
          <View style={[styles.infoItem, styles.infoItemLast]}>
            <AppIcon name="report" size={16} color={tint} />
            <ThemedText style={styles.infoKey}>API server</ThemedText>
            <ThemedText style={[styles.infoValue, styles.infoValueMono]} numberOfLines={2}>
              {apiOrigin}
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(Motion.enterMedium)}>
        <AnimatedPressable
          style={styles.logoutButton}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={handleLogout}>
          <ThemedText style={styles.logoutText}>Log out</ThemedText>
        </AnimatedPressable>
      </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F6F8',
  },
  titleCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#DCE3EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 8,
  },
  eyebrow: {
    color: '#5C6B7F',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  subtitle: {
    color: '#3D4F66',
  },
  infoCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#DCE3EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    paddingVertical: 8,
    gap: 8,
  },
  infoItemLast: {
    borderBottomWidth: 0,
  },
  infoKey: {
    color: '#64748B',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  infoValue: {
    color: '#0F172A',
    fontWeight: '600',
    marginLeft: 'auto',
  },
  infoValueMono: {
    fontSize: 12,
    maxWidth: '62%',
    textAlign: 'right',
  },
  logoutButton: {
    marginTop: 8,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#D22B2B',
    fontWeight: '700',
  },
});
