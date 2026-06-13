import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppIcon } from '@/components/ui/app-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { API_BASE_URL, API_CONFIG_ERROR } from '@/constants/api';
import { Motion, Radii, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useResponsiveContent } from '@/hooks/use-responsive-content';
import { useThemeColor } from '@/hooks/use-theme-color';
import { apiFetch, postJson } from '@/lib/api-client';
import { fetchAuthenticatedPngDataUri } from '@/lib/fetch-image-data-uri';
import {
  clearTerminalFailedCheckins,
  enqueueCheckin,
  type QueuedCheckin,
  readQueuedCheckins,
  removeQueuedCheckin,
  updateQueuedCheckin,
} from '@/lib/offline-checkin-queue';
import { paginatedItems, paginatedTotal } from '@/lib/pagination';

const roleLabel = (role?: string) => {
  const r = String(role ?? '').toLowerCase();
  if (r === 'admin') return 'Administrator';
  if (r === 'teacher') return 'Teacher';
  return 'Student';
};

type Banner = { variant: 'success' | 'error' | 'info'; text: string };

type TeacherClassChoice = {
  id: number;
  label: string;
  schoolYearId?: number;
};

const MIN_QR_PAYLOAD_LEN = 5;
const MAX_QR_PAYLOAD_LEN = 500;
const SCAN_DEBOUNCE_MS = 1000;

function todayIso() {
  // yyyy-mm-dd in local time
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function formatQueuedTime(value: number): string {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

export default function HomeScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { horizontalPadding, contentShell } = useResponsiveContent();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [checkinPayload, setCheckinPayload] = useState('');
  const [teacherClassId, setTeacherClassId] = useState<number | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [classChoices, setClassChoices] = useState<TeacherClassChoice[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const lastScanRef = useRef<{ ts: number; payload: string }>({ ts: 0, payload: '' });
  const [activeSession, setActiveSession] = useState<{
    id: number;
    qrPayload: string;
    expiresAt?: string;
  } | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [closingSession, setClosingSession] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [pendingCheckins, setPendingCheckins] = useState(0);
  const [queuedItems, setQueuedItems] = useState<QueuedCheckin[]>([]);
  const [syncingCheckins, setSyncingCheckins] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);

  const scannerFrameHeight = useMemo(
    () => Math.min(320, Math.max(220, Math.round(windowHeight * 0.32))),
    [windowHeight]
  );
  const qrDisplaySize = useMemo(
    () =>
      Math.min(
        280,
        Math.max(176, Math.round(Math.min(windowWidth - horizontalPadding * 2 - Spacing.xl * 2, 520) * 0.72))
      ),
    [windowWidth, horizontalPadding]
  );

  const showBanner = useCallback((next: Banner | null) => setBanner(next), []);

  const normalizeQrPayload = useCallback((value: string) => value.replace(/\s+/g, ' ').trim(), []);

  const toUserError = useCallback((requestError: unknown, fallback: string) => {
    const message = requestError instanceof Error ? requestError.message : fallback;
    const lower = message.toLowerCase();
    if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
      return 'Cannot reach server. Check internet/LAN and backend status.';
    }
    if (lower.includes('timed out')) return 'Request timed out. Please try again.';
    return message || fallback;
  }, []);

  const isRetryableOfflineError = useCallback((requestError: unknown) => {
    const message = requestError instanceof Error ? requestError.message : '';
    const lower = message.toLowerCase();
    return (
      lower.includes('network request failed') ||
      lower.includes('failed to fetch') ||
      lower.includes('timed out') ||
      lower.includes('cannot reach server')
    );
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const items = await readQueuedCheckins();
    setPendingCheckins(items.length);
    setQueuedItems(items);
    return items;
  }, []);

  const flushOfflineQueue = useCallback(
    async (silent = false) => {
      if (!token || user?.role !== 'student') return;
      setSyncingCheckins(true);
      try {
        let queue = await readQueuedCheckins();
        setQueuedItems(queue);
        if (!queue.length) {
          setPendingCheckins(0);
          setQueuedItems([]);
          if (!silent) showBanner({ variant: 'info', text: 'No pending offline check-ins.' });
          return;
        }

        let synced = 0;
        let dropped = 0;
        for (const item of queue) {
          try {
            await postJson('/api/student/attendance-sessions/check-in', { qr_payload: item.payload }, token, 12000);
            queue = await removeQueuedCheckin(item.id);
            setQueuedItems(queue);
            synced += 1;
          } catch (requestError) {
            const msg = toUserError(requestError, 'Unable to sync check-in.');
            const lower = msg.toLowerCase();
            const terminal =
              lower.includes('invalid') ||
              lower.includes('expired') ||
              lower.includes('closed') ||
              lower.includes('not found') ||
              lower.includes('already');
            if (terminal) {
              queue = await removeQueuedCheckin(item.id);
              setQueuedItems(queue);
              dropped += 1;
            } else {
              queue = await updateQueuedCheckin(item.id, {
                attempts: Number(item.attempts || 0) + 1,
                lastError: msg,
              });
              setQueuedItems(queue);
            }
          }
        }
        setPendingCheckins(queue.length);
        setQueuedItems(queue);
        if (!silent) {
          if (synced > 0) {
            showBanner({
              variant: 'success',
              text:
                dropped > 0
                  ? `Synced ${synced} pending check-in(s). Removed ${dropped} invalid/expired item(s).`
                  : `Synced ${synced} pending check-in(s).`,
            });
          } else if (queue.length > 0) {
            showBanner({ variant: 'info', text: `${queue.length} check-in(s) still pending sync.` });
          } else {
            showBanner({ variant: 'info', text: 'Pending queue is clear.' });
          }
        }
      } finally {
        setSyncingCheckins(false);
      }
    },
    [showBanner, toUserError, token, user?.role]
  );

  const removeQueuedItem = useCallback(
    async (id: string) => {
      const next = await removeQueuedCheckin(id);
      setQueuedItems(next);
      setPendingCheckins(next.length);
      showBanner({ variant: 'info', text: 'Removed queued check-in item.' });
    },
    [showBanner]
  );

  const clearTerminalQueueItems = useCallback(async () => {
    const next = await clearTerminalFailedCheckins();
    setQueuedItems(next);
    setPendingCheckins(next.length);
    showBanner({ variant: 'info', text: 'Cleared terminal failed queue items.' });
  }, [showBanner]);

  const retryQueuedItem = useCallback(
    async (item: QueuedCheckin) => {
      if (!token || user?.role !== 'student') return;
      setSyncingCheckins(true);
      try {
        await postJson('/api/student/attendance-sessions/check-in', { qr_payload: item.payload }, token, 12000);
        const next = await removeQueuedCheckin(item.id);
        setQueuedItems(next);
        setPendingCheckins(next.length);
        showBanner({ variant: 'success', text: 'Queued check-in synced successfully.' });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
          queryClient.invalidateQueries({ queryKey: ['announcements-list'] }),
        ]);
      } catch (requestError) {
        const msg = toUserError(requestError, 'Unable to sync queued check-in.');
        const next = await updateQueuedCheckin(item.id, {
          attempts: Number(item.attempts || 0) + 1,
          lastError: msg,
        });
        setQueuedItems(next);
        setPendingCheckins(next.length);
        showBanner({ variant: 'error', text: msg });
      } finally {
        setSyncingCheckins(false);
      }
    },
    [queryClient, toUserError, token, user?.role, showBanner]
  );

  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');

  const studentQuery = useQuery({
    queryKey: ['student-dashboard', user?.id],
    enabled: Boolean(token && user?.role === 'student'),
    queryFn: async () => {
      const [statsPayload, announcementsPayload] = await Promise.all([
        apiFetch<{ data?: { summary?: { attendance_rate?: number; total_records?: number } } }>(
          '/api/student/dashboard-stats',
          { token }
        ),
        apiFetch<{ data?: unknown; read_ids?: number[] }>('/api/student/announcements', { token }),
      ]);
      const summary = statsPayload?.data?.summary ?? {};
      const announcements = paginatedItems<{ id: number }>(announcementsPayload);
      const readIds = announcementsPayload?.read_ids ?? [];
      return {
        attendanceRate: Number(summary.attendance_rate ?? 0),
        totalRecords: Number(summary.total_records ?? 0),
        unreadAnnouncements: announcements.filter((item) => !readIds.includes(item.id)).length,
      };
    },
  });

  const teacherQuery = useQuery({
    queryKey: ['teacher-dashboard', user?.id],
    enabled: Boolean(token && user?.role === 'teacher'),
    queryFn: async () => {
      const [classesPayload, reportsPayload, announcementsPayload, teachingPayload] = await Promise.all([
        apiFetch<{ data?: { id: number; class_name?: string; section?: string; school_year_id?: number; schoolYear?: { id?: number; name?: string } }[] }>(
          '/api/teacher/classes',
          { token }
        ),
        apiFetch<{ data?: unknown }>('/api/teacher/absence-reports', { token }),
        apiFetch<{ data?: unknown }>('/api/teacher/announcements', { token }),
        apiFetch<{ data?: { subject?: { id?: number; name?: string } }[] }>('/api/teacher/my-teaching', { token }),
      ]);

      const classes = classesPayload?.data ?? [];
      const teaching = teachingPayload?.data ?? [];
      const reportRows = paginatedItems<{ status?: string }>(reportsPayload);
      const pendingReports = reportRows.filter((item) => String(item.status ?? '').toLowerCase() === 'pending')
        .length;

      return {
        stats: {
          classes: classes.length,
          pendingAbsenceReports: pendingReports,
          announcements: paginatedTotal(announcementsPayload),
        },
        classChoices: classes.map((item) => ({
          id: item.id,
          label: `${item.class_name ?? 'Class'}${item.section ? ` - Sec ${item.section}` : ''}${
            item.schoolYear?.name ? ` · ${item.schoolYear.name}` : ''
          }`,
          schoolYearId: Number(item.school_year_id ?? item.schoolYear?.id ?? 0) || undefined,
        })),
        subjectChoices: teaching
          .map((item) => item.subject)
          .filter((subject): subject is { id: number; name?: string } => Boolean(subject?.id))
          .map((subject) => ({ id: subject.id, label: subject.name ?? `Subject ${subject.id}` })),
      };
    },
  });

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      const keyPrefix = user?.role === 'teacher' ? 'teacher-dashboard' : 'student-dashboard';
      await queryClient.refetchQueries({ queryKey: [keyPrefix, user?.id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['announcements-list'] }),
        queryClient.invalidateQueries({ queryKey: ['announcements-count'] }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [queryClient, user?.id, user?.role]);

  const loading = studentQuery.isLoading || teacherQuery.isLoading;
  const studentStats = studentQuery.data ?? { attendanceRate: 0, totalRecords: 0, unreadAnnouncements: 0 };
  const teacherStats = teacherQuery.data?.stats ?? { classes: 0, pendingAbsenceReports: 0, announcements: 0 };

  const dashQuery =
    user?.role === 'teacher' ? teacherQuery : user?.role === 'student' ? studentQuery : null;
  const dashFailed = Boolean(dashQuery?.isError);
  const hasDashData = Boolean(dashQuery?.data);
  const dashHardFail = dashFailed && !hasDashData;
  const dashStaleError = dashFailed && hasDashData;
  const dashErrorMessage =
    dashQuery?.error instanceof Error ? dashQuery.error.message : 'Could not load dashboard.';

  useEffect(() => {
    const onAppStateChange = (state: string) => {
      if (state !== 'active') {
        setScannerOpen(false);
        setScanLocked(false);
        setFlashlightOn(false);
        return;
      }
      const role = user?.role;
      if (role !== 'teacher' && role !== 'student') return;
      const key = role === 'teacher' ? 'teacher-dashboard' : 'student-dashboard';
      void queryClient.invalidateQueries({ queryKey: [key, user?.id] });
      if (role === 'student') {
        void flushOfflineQueue(true);
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [flushOfflineQueue, queryClient, user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== 'student') {
      setPendingCheckins(0);
      return;
    }
    void refreshPendingCount();
    void flushOfflineQueue(true);
  }, [flushOfflineQueue, refreshPendingCount, user?.role]);

  useEffect(() => {
    if (!scannerOpen) setFlashlightOn(false);
  }, [scannerOpen]);

  useEffect(() => {
    if (teacherQuery.data) {
      setClassChoices(teacherQuery.data.classChoices);
      if (!teacherClassId && teacherQuery.data.classChoices.length) {
        setTeacherClassId(teacherQuery.data.classChoices[0].id);
      }
    }
  }, [teacherQuery.data, teacherClassId]);

  useEffect(() => {
    if (!activeSession?.id || !token) {
      setQrDataUri(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const size = Math.min(512, Math.max(240, Math.round(qrDisplaySize * 2)));
        const uri = await fetchAuthenticatedPngDataUri(
          `${API_BASE_URL}/api/teacher/attendance-sessions/${activeSession.id}/qr?format=png&size=${size}`,
          token
        );
        if (!cancelled) setQrDataUri(uri);
      } catch {
        if (!cancelled) setQrDataUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSession?.id, token, qrDisplaySize]);

  const handleStudentCheckin = async () => {
    const normalizedPayload = normalizeQrPayload(checkinPayload);
    if (!normalizedPayload) {
      showBanner({ variant: 'error', text: 'Paste QR payload first.' });
      return;
    }
    if (normalizedPayload.length < MIN_QR_PAYLOAD_LEN || normalizedPayload.length > MAX_QR_PAYLOAD_LEN) {
      showBanner({ variant: 'error', text: 'Invalid QR payload length.' });
      return;
    }
    setIsSubmitting(true);
    showBanner(null);
    try {
      await postJson('/api/student/attendance-sessions/check-in', { qr_payload: normalizedPayload }, token, 12000);
      setCheckinPayload('');
      showBanner({ variant: 'success', text: 'Check-in successful.' });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['announcements-list'] }),
      ]);
    } catch (requestError) {
      if (isRetryableOfflineError(requestError)) {
        const queue = await enqueueCheckin(normalizedPayload);
        setPendingCheckins(queue.length);
        showBanner({
          variant: 'info',
          text: `Offline mode: check-in queued (${queue.length} pending). It will sync automatically.`,
        });
      } else {
        showBanner({ variant: 'error', text: toUserError(requestError, 'Check-in failed.') });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScanPayload = async (payload: string) => {
    const trimmedPayload = normalizeQrPayload(payload);
    if (!trimmedPayload) {
      showBanner({ variant: 'error', text: 'Scanned QR is empty.' });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    if (trimmedPayload.length < MIN_QR_PAYLOAD_LEN) {
      showBanner({ variant: 'error', text: 'QR code appears invalid (too short).' });
      return;
    }

    if (trimmedPayload.length > MAX_QR_PAYLOAD_LEN) {
      showBanner({ variant: 'error', text: 'QR code appears invalid (too long).' });
      return;
    }

    setIsSubmitting(true);
    showBanner(null);
    try {
      await postJson('/api/student/attendance-sessions/check-in', { qr_payload: trimmedPayload }, token);
      showBanner({ variant: 'success', text: 'Check-in successful.' });
      setCheckinPayload('');
      setScannerOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['announcements-list'] }),
      ]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (requestError) {
      let errorMsg = toUserError(requestError, 'Check-in failed.');
      const low = errorMsg.toLowerCase();
      if (low.includes('not found') || low.includes('invalid')) {
        errorMsg = 'Invalid QR. Scan the class attendance code from your teacher.';
      } else if (low.includes('expired') || low.includes('closed')) {
        errorMsg = 'This session QR is closed or expired. Ask your teacher for a new session.';
      } else if (low.includes('already')) {
        errorMsg = 'You are already checked in for this session.';
      }
      if (isRetryableOfflineError(requestError)) {
        const queue = await enqueueCheckin(trimmedPayload);
        setPendingCheckins(queue.length);
        showBanner({
          variant: 'info',
          text: `Offline mode: scan queued (${queue.length} pending). It will sync automatically.`,
        });
      } else {
        showBanner({ variant: 'error', text: errorMsg });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsSubmitting(false);
      setScanLocked(false);
    }
  };

  const handleCreateTeacherSession = async () => {
    const selected = classChoices.find((c) => Number(c.id) === Number(teacherClassId));
    const schoolYearId = Number(selected?.schoolYearId ?? 0);
    if (!teacherClassId || !schoolYearId) {
      showBanner({ variant: 'error', text: 'Select a class with a valid school year.' });
      return;
    }
    const normalizedDate = attendanceDate.trim();
    if (!isValidIsoDate(normalizedDate)) {
      showBanner({ variant: 'error', text: 'Attendance date must be YYYY-MM-DD.' });
      return;
    }
    const durationValue = Number(durationMinutes || '15');
    if (!Number.isFinite(durationValue) || durationValue < 5 || durationValue > 180) {
      showBanner({ variant: 'error', text: 'Duration must be between 5 and 180 minutes.' });
      return;
    }
    setIsSubmitting(true);
    showBanner(null);
    try {
      const payload = (await postJson(
        '/api/teacher/attendance-sessions',
        {
          class_id: Number(teacherClassId),
          school_year_id: Number(schoolYearId),
          attendance_date: normalizedDate,
          duration_minutes: durationValue,
        },
        token,
        12000
      )) as { data?: { id?: number }; qr_payload?: string; expires_at?: unknown };

      const sessionRow = payload?.data ?? {};
      const id = Number(sessionRow.id ?? 0);
      const qrPayload = String(payload?.qr_payload ?? '');
      const expiresAt = payload?.expires_at != null ? String(payload.expires_at) : undefined;
      if (id && qrPayload) {
        setActiveSession({ id, qrPayload, expiresAt });
        showBanner({ variant: 'info', text: 'Session is open — students can scan the QR below.' });
      } else {
        showBanner({ variant: 'info', text: qrPayload ? `Payload: ${qrPayload.slice(0, 120)}…` : 'Session created.' });
      }
      await queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (requestError) {
      showBanner({
        variant: 'error',
        text: toUserError(requestError, 'Unable to create session.'),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession?.id || !token) return;
    setClosingSession(true);
    showBanner(null);
    try {
      await postJson(`/api/teacher/attendance-sessions/${activeSession.id}/close`, {}, token, 12000);
      setActiveSession(null);
      setQrDataUri(null);
      showBanner({ variant: 'success', text: 'Session closed.' });
      await queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (requestError) {
      showBanner({
        variant: 'error',
        text: toUserError(requestError, 'Unable to close session.'),
      });
    } finally {
      setClosingSession(false);
    }
  };

  const scrollInsetStyle = [
    styles.scrollContent,
    contentShell,
    {
      paddingHorizontal: horizontalPadding,
      paddingTop: Spacing.md,
      paddingBottom: Math.max(insets.bottom, 28) + Spacing.xl,
    },
  ];

  const bannerStyle =
    banner?.variant === 'success'
      ? styles.bannerSuccess
      : banner?.variant === 'info'
        ? styles.bannerInfo
        : banner?.variant === 'error'
          ? styles.bannerError
          : null;

  if (user?.role === 'admin') {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: background }]}
        contentContainerStyle={scrollInsetStyle}
        keyboardShouldPersistTaps="handled">
        <ThemedView style={[styles.card, { borderColor: border, backgroundColor: surface }]}>
          <ThemedText type="title">Mobile scanner not enabled for admins</ThemedText>
          <ThemedText style={[styles.mutedText, { color: muted }]}>
            This app currently supports Student check-in and Teacher session QR only. Please use the web portal for admin tasks.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: background }]}
      contentContainerStyle={scrollInsetStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={pullRefreshing}
          onRefresh={onPullRefresh}
          tintColor={tint}
        />
      }>
      <Animated.View entering={FadeInDown.duration(Motion.enterMedium)}>
        <ThemedView style={[styles.headerCard, { borderColor: border, backgroundColor: surface }]}>
          <ThemedText type="eyebrow" style={[styles.eyebrow, { color: muted }]}>
            Dashboard
          </ThemedText>
          <ThemedText type="title">QR Attendance</ThemedText>
          <ThemedText style={[styles.subtitle, { color: muted }]}>
            Welcome {user?.displayName} ({roleLabel(user?.role)}).
          </ThemedText>
        </ThemedView>
      </Animated.View>

      {dashStaleError && (
        <Animated.View entering={FadeInDown.delay(40).duration(Motion.enterFast)}>
          <View style={[styles.card, styles.staleRefreshRow, { borderColor: border, backgroundColor: surface }]}>
            <AppIcon name="report" size={18} color={tint} />
            <ThemedText style={[styles.staleRefreshText, { color: muted }]}>Could not refresh.</ThemedText>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Retry refreshing dashboard"
              onPress={() => void dashQuery?.refetch()}
              style={styles.staleRetryPressable}>
              <ThemedText style={[styles.staleRetryLabel, { color: tint }]}>Retry</ThemedText>
            </AnimatedPressable>
          </View>
        </Animated.View>
      )}

      {dashHardFail ? (
        <Animated.View entering={FadeInDown.delay(60).duration(Motion.enterFast)}>
          <View style={[styles.card, styles.dashboardErrorCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
            <ThemedText type="subtitle">Could not load dashboard</ThemedText>
            <ThemedText style={[styles.dashboardErrorDetail, { color: muted }]}>{dashErrorMessage}</ThemedText>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Try loading dashboard again"
              style={styles.actionButton}
              onPress={() => void dashQuery?.refetch()}>
              <ThemedText style={styles.actionButtonText}>Try again</ThemedText>
            </AnimatedPressable>
          </View>
        </Animated.View>
      ) : loading ? (
        <View style={[styles.card, { borderColor: border, backgroundColor: surface }]}>
          <Skeleton height={16} width="34%" />
          <Skeleton height={26} width="56%" />
          <Skeleton height={84} />
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(60).duration(Motion.enterFast)}>
          <View style={[styles.statsRow, windowWidth < 360 && styles.statsRowWrap]}>
            {user?.role === 'teacher' ? (
              <>
                <View style={[styles.statTile, { borderColor: border, backgroundColor: surface }]}>
                  <AppIcon name="class" size={16} color={tint} />
                  <ThemedText style={[styles.statLabel, { color: muted }]}>Classes</ThemedText>
                  <ThemedText type="metric">{teacherStats.classes}</ThemedText>
                </View>
                <View style={[styles.statTile, { borderColor: border, backgroundColor: surface }]}>
                  <AppIcon name="report" size={16} color={tint} />
                  <ThemedText style={[styles.statLabel, { color: muted }]}>Pending</ThemedText>
                  <ThemedText type="metric">{teacherStats.pendingAbsenceReports}</ThemedText>
                </View>
                <View style={[styles.statTile, { borderColor: border, backgroundColor: surface }]}>
                  <AppIcon name="bell" size={16} color={tint} />
                  <ThemedText style={[styles.statLabel, { color: muted }]}>Alerts</ThemedText>
                  <ThemedText type="metric">{teacherStats.announcements}</ThemedText>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.statTile, { borderColor: border, backgroundColor: surface }]}>
                  <AppIcon name="stats" size={16} color={tint} />
                  <ThemedText style={[styles.statLabel, { color: muted }]}>Rate</ThemedText>
                  <ThemedText type="metric">{studentStats.attendanceRate}%</ThemedText>
                </View>
                <View style={[styles.statTile, { borderColor: border, backgroundColor: surface }]}>
                  <AppIcon name="dashboard" size={16} color={tint} />
                  <ThemedText style={[styles.statLabel, { color: muted }]}>Records</ThemedText>
                  <ThemedText type="metric">{studentStats.totalRecords}</ThemedText>
                </View>
                <View style={[styles.statTile, { borderColor: border, backgroundColor: surface }]}>
                  <AppIcon name="bell" size={16} color={tint} />
                  <ThemedText style={[styles.statLabel, { color: muted }]}>Unread</ThemedText>
                  <ThemedText type="metric">{studentStats.unreadAnnouncements}</ThemedText>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {dashHardFail ? null : loading ? (
        <View style={[styles.card, { borderColor: border, backgroundColor: surface }]}>
          <ActivityIndicator color={tint} />
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(120).duration(Motion.enterMedium)}>
          <View style={[styles.card, styles.spotlightCard, { borderColor: border, backgroundColor: surface }]}>
            <ThemedText type="subtitle">
              {user?.role === 'teacher' ? 'Start attendance session' : 'Student check-in'}
            </ThemedText>
            <ThemedText style={[styles.mutedText, { color: muted }]}>
              {user?.role === 'teacher'
                ? 'Create a class attendance session using your class and subject.'
                : 'Paste QR payload from your teacher QR to check in.'}
            </ThemedText>

            {user?.role === 'teacher' ? (
              <>
                <ThemedText style={[styles.mutedText, { color: muted }]}>
                  Select your class, confirm date and duration, then generate the session QR for students.
                </ThemedText>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.pillScroll}>
                  {classChoices.map((c) => {
                    const active = Number(teacherClassId) === Number(c.id);
                    return (
                      <AnimatedPressable
                        key={c.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Class ${c.label}`}
                        style={[styles.pill, active && styles.pillActive, { borderColor: border }]}
                        onPress={() => setTeacherClassId(c.id)}>
                        <ThemedText style={[styles.pillText, { color: active ? '#FFFFFF' : muted }]} numberOfLines={1}>
                          {c.label}
                        </ThemedText>
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>
                <TextInput
                  style={[styles.input, { borderColor: border, backgroundColor: surface }]}
                  value={attendanceDate}
                  onChangeText={setAttendanceDate}
                  placeholder="Attendance date (YYYY-MM-DD)"
                  placeholderTextColor={muted}
                />
                <TextInput
                  style={[styles.input, { borderColor: border, backgroundColor: surface }]}
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  placeholder="Duration minutes (default 15)"
                  placeholderTextColor={muted}
                  keyboardType="number-pad"
                />
                <AnimatedPressable
                  style={[styles.actionButton, { backgroundColor: tint }]}
                  accessibilityRole="button"
                  accessibilityLabel="Create attendance session"
                  onPress={handleCreateTeacherSession}
                  disabled={isSubmitting}>
                  <ThemedText style={styles.actionButtonText}>
                    {isSubmitting ? 'Submitting...' : 'Create Session'}
                  </ThemedText>
                </AnimatedPressable>
                {activeSession ? (
                  <View style={[styles.activeSession, { borderColor: border, backgroundColor: surface }]}>
                    <ThemedText type="subtitle">Live attendance QR</ThemedText>
                    <ThemedText style={[styles.sessionMeta, { color: muted }]}>
                      Session #{activeSession.id}
                      {activeSession.expiresAt ? ` · ends ${activeSession.expiresAt.slice(0, 16)}` : ''}
                    </ThemedText>
                    {qrDataUri ? (
                      <Image
                        source={{ uri: qrDataUri }}
                        style={{ width: qrDisplaySize, height: qrDisplaySize, borderRadius: Radii.sm }}
                        contentFit="contain"
                        accessibilityLabel="Attendance session QR code"
                      />
                    ) : (
                      <View style={styles.qrLoading}>
                        <ActivityIndicator color={tint} />
                        <ThemedText style={[styles.sessionMeta, { color: muted }]}>Loading QR…</ThemedText>
                      </View>
                    )}
                    <ThemedText style={[styles.payloadHint, { color: muted }]} selectable numberOfLines={4}>
                      {activeSession.qrPayload}
                    </ThemedText>
                    <AnimatedPressable
                      style={styles.closeSessionBtn}
                      onPress={handleCloseSession}
                      disabled={closingSession}>
                      <ThemedText style={styles.closeSessionText}>
                        {closingSession ? 'Closing…' : 'Close session'}
                      </ThemedText>
                    </AnimatedPressable>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {scannerOpen && (
                  <View style={[styles.scannerWrap, { borderColor: border }]}>
                    {cameraPermission?.granted ? (
                      <View style={{ position: 'relative' }}>
                        <CameraView
                          style={[styles.scanner, { height: scannerFrameHeight }]}
                          facing="back"
                          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                          enableTorch={flashlightOn}
                          onBarcodeScanned={
                            scanLocked || isSubmitting
                              ? undefined
                              : ({ data }) => {
                                  const now = Date.now();
                                  const normalized = normalizeQrPayload(data ?? '');
                                  const isFastDuplicate =
                                    lastScanRef.current.payload === normalized &&
                                    now - lastScanRef.current.ts < SCAN_DEBOUNCE_MS;
                                  if (isFastDuplicate || now - lastScanRef.current.ts < SCAN_DEBOUNCE_MS) {
                                    return;
                                  }
                                  lastScanRef.current = { ts: now, payload: normalized };
                                  setScanLocked(true);
                                  setCheckinPayload(normalized);
                                  handleScanPayload(normalized);
                                }
                          }
                        />
                        <AnimatedPressable
                          style={[styles.flashlightButton, flashlightOn && styles.flashlightButtonActive]}
                          onPress={() => setFlashlightOn(!flashlightOn)}>
                          <ThemedText style={styles.flashlightButtonText}>
                            {flashlightOn ? 'Flashlight On' : 'Flashlight Off'}
                          </ThemedText>
                        </AnimatedPressable>
                      </View>
                    ) : (
                      <View style={[styles.permissionCard, { backgroundColor: surface }]}>
                        <ThemedText style={[styles.mutedText, { color: muted }]}>
                          Camera permission is required to scan QR.
                        </ThemedText>
                        {cameraPermission?.canAskAgain === false ? (
                          <ThemedText style={[styles.permissionHint, { color: muted }]}>
                            Permission denied permanently. Enable camera permission from system app settings.
                          </ThemedText>
                        ) : null}
                        <AnimatedPressable
                          style={[styles.actionButton, { backgroundColor: tint }]}
                          onPress={() => {
                            requestCameraPermission().catch(() => {
                              showBanner({ variant: 'error', text: 'Unable to request camera permission.' });
                            });
                          }}>
                          <ThemedText style={styles.actionButtonText}>Allow Camera</ThemedText>
                        </AnimatedPressable>
                      </View>
                    )}
                  </View>
                )}
                <TextInput
                  style={[styles.input, styles.payloadInput, { borderColor: border, backgroundColor: surface }]}
                  value={checkinPayload}
                  onChangeText={(t) => {
                    setCheckinPayload(t);
                    if (banner) setBanner(null);
                  }}
                  placeholder="Paste QR payload"
                  placeholderTextColor={muted}
                  multiline
                />
                <AnimatedPressable
                  style={[styles.actionButton, styles.secondaryButton]}
                  accessibilityRole="button"
                  accessibilityLabel={scannerOpen ? 'Close camera scanner' : 'Open camera scanner'}
                  onPress={() => {
                    if (!cameraPermission?.granted) {
                      requestCameraPermission();
                    }
                    setScanLocked(false);
                    setScannerOpen((prev) => !prev);
                  }}>
                  <ThemedText style={styles.actionButtonText}>
                    {scannerOpen ? 'Close Scanner' : 'Scan QR with Camera'}
                  </ThemedText>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.actionButton, { backgroundColor: tint }]}
                  accessibilityRole="button"
                  accessibilityLabel="Submit attendance check-in"
                  onPress={handleStudentCheckin}
                  disabled={isSubmitting}>
                  <ThemedText style={styles.actionButtonText}>
                    {isSubmitting ? 'Submitting...' : 'Check In Now'}
                  </ThemedText>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.actionButton, styles.secondaryButton]}
                  accessibilityRole="button"
                  accessibilityLabel="Sync pending check-ins"
                  onPress={() => void flushOfflineQueue(false)}
                  disabled={syncingCheckins}>
                  <ThemedText style={styles.actionButtonText}>
                    {syncingCheckins
                      ? 'Syncing...'
                      : pendingCheckins > 0
                        ? `Sync Pending (${pendingCheckins})`
                        : 'Sync Pending'}
                  </ThemedText>
                </AnimatedPressable>
              </>
            )}
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(180).duration(Motion.enterMedium)}>
        <View style={[styles.card, { borderColor: border, backgroundColor: surface }]}>
          <ThemedText type="subtitle">Status & Actions</ThemedText>
          {API_CONFIG_ERROR ? (
            <ThemedText style={styles.bannerError}>
              {API_CONFIG_ERROR}
            </ThemedText>
          ) : null}
          <ThemedText style={[styles.mutedText, { color: muted }]}>
            {user?.role === 'teacher'
              ? 'Ready to open attendance session for current class.'
              : 'Scan class QR to record attendance instantly.'}
          </ThemedText>
          {user?.role === 'student' ? (
            <ThemedText style={[styles.mutedText, { color: muted }]}>
              {pendingCheckins > 0
                ? `${pendingCheckins} check-in(s) queued offline and waiting to sync.`
                : 'No pending offline check-ins.'}
            </ThemedText>
          ) : null}
          {user?.role === 'student' && queuedItems.length > 0 ? (
            <View style={styles.queueList}>
              <View style={styles.queueToolbar}>
                <AnimatedPressable
                  style={[styles.queueBtn, { borderColor: tint }]}
                  onPress={() => setQueueModalOpen(true)}>
                  <ThemedText style={[styles.queueBtnText, { color: tint }]}>
                    View all ({queuedItems.length})
                  </ThemedText>
                </AnimatedPressable>
                <AnimatedPressable style={[styles.queueBtn, styles.queueBtnDanger]} onPress={() => void clearTerminalQueueItems()}>
                  <ThemedText style={styles.queueBtnDangerText}>Clear terminal failures</ThemedText>
                </AnimatedPressable>
              </View>
              {queuedItems.slice(0, 5).map((item) => (
                <View key={item.id} style={[styles.queueItem, { borderColor: border, backgroundColor: surface }]}>
                  <View style={styles.queueItemTop}>
                    <ThemedText style={[styles.queueTime, { color: muted }]}>
                      Queued {formatQueuedTime(item.createdAt)}
                    </ThemedText>
                    <ThemedText style={[styles.queueMeta, { color: muted }]}>
                      tries: {item.attempts}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.queuePayload} numberOfLines={2}>
                    {item.payload}
                  </ThemedText>
                  {item.lastError ? (
                    <ThemedText style={styles.queueError} numberOfLines={2}>
                      {item.lastError}
                    </ThemedText>
                  ) : null}
                  <View style={styles.queueActions}>
                    <AnimatedPressable
                      style={[styles.queueBtn, { borderColor: tint }]}
                      onPress={() => void retryQueuedItem(item)}
                      disabled={syncingCheckins}>
                      <ThemedText style={[styles.queueBtnText, { color: tint }]}>Retry</ThemedText>
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={[styles.queueBtn, styles.queueBtnDanger]}
                      onPress={() => void removeQueuedItem(item.id)}
                      disabled={syncingCheckins}>
                      <ThemedText style={styles.queueBtnDangerText}>Remove</ThemedText>
                    </AnimatedPressable>
                  </View>
                </View>
              ))}
              {queuedItems.length > 5 ? (
                <ThemedText style={[styles.queueMeta, { color: muted }]}>
                  +{queuedItems.length - 5} more queued item(s)
                </ThemedText>
              ) : null}
            </View>
          ) : null}
          {banner ? (
            <ThemedText style={[styles.feedbackText, bannerStyle]}>{banner.text}</ThemedText>
          ) : null}
        </View>
      </Animated.View>
      <Modal
        visible={queueModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setQueueModalOpen(false)}>
        <View style={styles.queueModalBackdrop}>
          <View style={[styles.queueModalCard, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.queueModalHeader}>
              <ThemedText type="subtitle">Pending Queue ({queuedItems.length})</ThemedText>
              <AnimatedPressable style={[styles.queueBtn, { borderColor: border }]} onPress={() => setQueueModalOpen(false)}>
                <ThemedText style={[styles.queueBtnText, { color: muted }]}>Close</ThemedText>
              </AnimatedPressable>
            </View>
            <ScrollView contentContainerStyle={styles.queueModalList} showsVerticalScrollIndicator={false}>
              {queuedItems.length === 0 ? (
                <ThemedText style={[styles.mutedText, { color: muted }]}>No pending queue items.</ThemedText>
              ) : (
                queuedItems.map((item) => (
                  <View key={item.id} style={[styles.queueItem, { borderColor: border, backgroundColor: surface }]}>
                    <View style={styles.queueItemTop}>
                      <ThemedText style={[styles.queueTime, { color: muted }]}>
                        Queued {formatQueuedTime(item.createdAt)}
                      </ThemedText>
                      <ThemedText style={[styles.queueMeta, { color: muted }]}>tries: {item.attempts}</ThemedText>
                    </View>
                    <ThemedText style={styles.queuePayload} numberOfLines={3}>
                      {item.payload}
                    </ThemedText>
                    {item.lastError ? <ThemedText style={styles.queueError}>{item.lastError}</ThemedText> : null}
                    <View style={styles.queueActions}>
                      <AnimatedPressable
                        style={[styles.queueBtn, { borderColor: tint }]}
                        onPress={() => void retryQueuedItem(item)}
                        disabled={syncingCheckins}>
                        <ThemedText style={[styles.queueBtnText, { color: tint }]}>Retry</ThemedText>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={[styles.queueBtn, styles.queueBtnDanger]}
                        onPress={() => void removeQueuedItem(item.id)}
                        disabled={syncingCheckins}>
                        <ThemedText style={styles.queueBtnDangerText}>Remove</ThemedText>
                      </AnimatedPressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F6F8',
  },
  scrollContent: {
    gap: 16,
  },
  statsRowWrap: {
    flexWrap: 'wrap',
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  bannerSuccess: {
    color: '#0F766E',
  },
  bannerInfo: {
    color: '#0369A1',
  },
  bannerError: {
    color: '#B91C1C',
  },
  headerCard: {
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: 104,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#DCE3EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
  },
  statLabel: {
    color: '#5C6B7F',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#DCE3EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  spotlightCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#0D9488',
  },
  staleRefreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  staleRefreshText: {
    flex: 1,
    minWidth: 120,
    fontWeight: '600',
  },
  staleRetryPressable: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  staleRetryLabel: {
    fontWeight: '700',
  },
  dashboardErrorCard: {
    gap: 12,
  },
  dashboardErrorDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  mutedText: {
    color: '#5C6B7F',
  },
  actionButton: {
    backgroundColor: '#0D9488',
    borderRadius: Radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCE3EB',
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  payloadInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  scannerWrap: {
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCE3EB',
  },
  scanner: {
    width: '100%',
  },
  permissionCard: {
    padding: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  permissionHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  queueList: {
    gap: 8,
    marginTop: 2,
  },
  queueToolbar: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  queueItem: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: 10,
    gap: 6,
  },
  queueItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  queueTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  queueMeta: {
    fontSize: 11,
  },
  queuePayload: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  queueError: {
    fontSize: 11,
    color: '#B91C1C',
  },
  queueActions: {
    flexDirection: 'row',
    gap: 8,
  },
  queueModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  queueModalCard: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    borderWidth: 1,
    padding: 14,
    maxHeight: '78%',
    gap: 10,
  },
  queueModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  queueModalList: {
    gap: 8,
    paddingBottom: 10,
  },
  queueBtn: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  queueBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  queueBtnDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  queueBtnDangerText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: '#0F766E',
  },
  pillScroll: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'nowrap',
    paddingVertical: 2,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    marginRight: 8,
    maxWidth: 280,
  },
  activeSession: {
    marginTop: 8,
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  sessionMeta: {
    fontSize: 12,
    textAlign: 'center',
  },
  qrLoading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payloadHint: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  closeSessionBtn: {
    marginTop: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  closeSessionText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  pillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  pillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  flashlightButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 50,
    padding: 12,
    zIndex: 10,
  },
  flashlightButtonActive: {
    backgroundColor: '#0D9488',
  },
  flashlightButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
