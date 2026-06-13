import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '@/constants/api';
import { apiFetch, postJson } from '@/lib/api-client';
import { setUnauthorizedHandler } from '@/lib/auth-events';
import { paginatedItems, paginatedTotal } from '@/lib/pagination';
import { queryClient } from '@/lib/query-client';
import { getJwtExpMs, isTokenExpired } from '@/lib/token-utils';

type UserRole = 'student' | 'teacher' | 'admin';

type AuthUser = {
  id?: number;
  identifier: string;
  displayName: string;
  role: UserRole;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isHydrating: boolean;
  login: (payload: { identifier: string; password: string; roleHint: UserRole }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = 'sars_mobile_session_v1';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const normalizeRole = (raw: unknown): UserRole => {
    const value = String(raw ?? '').toLowerCase();
    if (value.includes('admin')) return 'admin';
    if (value.includes('teacher') || value.includes('staff')) return 'teacher';
    return 'student';
  };

  const resolveDisplayName = (rawUser: Record<string, unknown>) =>
    String(
      rawUser.full_name ??
        rawUser.name ??
        `${String(rawUser.first_name ?? '')} ${String(rawUser.last_name ?? '')}`.trim() ??
        rawUser.email ??
        'User'
    );

  const clearSession = useCallback((opts?: { silent?: boolean }) => {
    const authToken = token;
    if (!opts?.silent && authToken) {
      postJson('/api/auth/logout', {}, authToken).catch(() => {});
    }
    setToken(null);
    setUser(null);
    setTokenExpiresAt(null);
    queryClient.clear();
    SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
  }, [token]);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser; tokenExpiresAt?: number | null };
        if (parsed?.token && parsed?.user) {
          if (isTokenExpired(parsed.token)) {
            await SecureStore.deleteItemAsync(SESSION_KEY);
            return;
          }
          setToken(parsed.token);
          setUser(parsed.user);
          setTokenExpiresAt(parsed.tokenExpiresAt ?? getJwtExpMs(parsed.token));
        }
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      } finally {
        setIsHydrating(false);
      }
    };
    hydrate();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession({ silent: true });
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    if (!token || !tokenExpiresAt) return;
    const delay = Math.max(0, tokenExpiresAt - Date.now());
    const timer = setTimeout(() => {
      clearSession({ silent: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [clearSession, token, tokenExpiresAt]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isHydrating,
      login: async ({ identifier, password, roleHint }) => {
        try {
          const loginPayload = await postJson<Record<string, unknown>>('/api/auth/login', {
            login: identifier,
            ...(identifier.includes('@') ? { email: identifier } : {}),
            password,
          });

          const lp = loginPayload && typeof loginPayload === 'object' ? loginPayload : {};
          const accessToken: string | undefined =
            typeof lp.token === 'string'
              ? lp.token
              : typeof lp.access_token === 'string'
                ? lp.access_token
                : lp.data && typeof lp.data === 'object' && lp.data !== null && 'token' in lp.data
                  ? String((lp.data as Record<string, unknown>).token ?? '')
                  : undefined;
          if (!accessToken) {
            throw new Error('No token returned by server.');
          }
          if (isTokenExpired(accessToken, 0)) {
            throw new Error('Session token is already expired. Please sign in again.');
          }
          const expiresAt = getJwtExpMs(accessToken);

          const mePayload = await apiFetch<Record<string, unknown>>('/api/auth/me', { token: accessToken });

          const meEnvelope = mePayload && typeof mePayload === 'object' ? mePayload : {};
          const nested = meEnvelope.user ?? meEnvelope.data;
          const rawUser = (
            typeof nested === 'object' && nested !== null ? nested : meEnvelope
          ) as Record<string, unknown>;
          const roleRaw = rawUser.role;
          const roleName =
            roleRaw && typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
              ? (roleRaw as { name?: string }).name
              : roleRaw;
          const role = normalizeRole(roleName ?? roleHint);

          const nextUser: AuthUser = {
            id: Number(rawUser.id ?? 0) || undefined,
            identifier,
            displayName: resolveDisplayName(rawUser),
            role,
          };
          setToken(accessToken);
          setUser(nextUser);
          setTokenExpiresAt(expiresAt);
          await SecureStore.setItemAsync(
            SESSION_KEY,
            JSON.stringify({ token: accessToken, user: nextUser, tokenExpiresAt: expiresAt })
          );

          if (nextUser.role === 'student') {
            queryClient.prefetchQuery({
              queryKey: ['student-dashboard', nextUser.id],
              queryFn: async () => {
                const [statsPayload, announcementsPayload] = await Promise.all([
                  apiFetch<{ data?: { summary?: { attendance_rate?: number; total_records?: number } } }>(
                    '/api/student/dashboard-stats',
                    { token: accessToken }
                  ),
                  apiFetch<{ data?: unknown; read_ids?: number[] }>('/api/student/announcements', {
                    token: accessToken,
                  }),
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
          } else {
            queryClient.prefetchQuery({
              queryKey: ['teacher-dashboard', nextUser.id],
              queryFn: async () => {
                const [classesPayload, reportsPayload, announcementsPayload, teachingPayload] = await Promise.all([
                  apiFetch<{ data?: { id: number; class_name?: string; section?: string }[] }>('/api/teacher/classes', {
                    token: accessToken,
                  }),
                  apiFetch<{ data?: unknown }>('/api/teacher/absence-reports', { token: accessToken }),
                  apiFetch<{ data?: unknown }>('/api/teacher/announcements', { token: accessToken }),
                  apiFetch<{ data?: { subject?: { id?: number; name?: string } }[] }>('/api/teacher/my-teaching', {
                    token: accessToken,
                  }),
                ]);

                const classes = classesPayload?.data ?? [];
                const teaching = teachingPayload?.data ?? [];
                const reportRows = paginatedItems<{ status?: string }>(reportsPayload);
                const pendingReports = reportRows.filter(
                  (item) => String(item.status ?? '').toLowerCase() === 'pending'
                ).length;

                return {
                  stats: {
                    classes: classes.length,
                    pendingAbsenceReports: pendingReports,
                    announcements: paginatedTotal(announcementsPayload),
                  },
                  classChoices: classes.map((item) => ({
                    id: item.id,
                    label: `${item.class_name ?? 'Class'}${item.section ? ` - Sec ${item.section}` : ''}`,
                  })),
                  subjectChoices: teaching
                    .map((item) => item.subject)
                    .filter((subject): subject is { id: number; name?: string } => Boolean(subject?.id))
                    .map((subject) => ({ id: subject.id, label: subject.name ?? `Subject ${subject.id}` })),
                };
              },
            });
          }
        } catch (requestError) {
          const message = requestError instanceof Error ? requestError.message : 'Unable to sign in.';
          if (message.toLowerCase().includes('network request failed') || message.toLowerCase().includes('fetch')) {
            throw new Error(`Cannot reach server at ${API_BASE_URL}. Check backend is running and phone is on same Wi-Fi.`);
          }
          throw requestError;
        }
      },
      logout: () => {
        clearSession();
      },
    }),
    [clearSession, isHydrating, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
