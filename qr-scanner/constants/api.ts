import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeBaseUrl(value: string | undefined | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function inferLanBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  if (!host) return '';
  return `http://${host}:8000`;
}

const envBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const inferredLanBaseUrl = normalizeBaseUrl(inferLanBaseUrl());
const enforceHttps =
  String(process.env.EXPO_PUBLIC_ENFORCE_HTTPS ?? (__DEV__ ? 'false' : 'true')).toLowerCase() === 'true';

/** Same value as backend `FRONTEND_API_KEY` when you use the optional API request gate. */
export const API_KEY = String(process.env.EXPO_PUBLIC_SARS_API_KEY ?? '').trim();

// Priority:
// 1) EXPO_PUBLIC_API_BASE_URL (recommended)
// 2) Expo LAN host -> http://<dev-machine-ip>:8000 (for physical devices)
// 3) Platform fallback
export const API_BASE_URL =
  envBaseUrl ||
  inferredLanBaseUrl ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

function isLocalHttp(baseUrl: string): boolean {
  return (
    baseUrl.startsWith('http://localhost') ||
    baseUrl.startsWith('http://127.0.0.1') ||
    baseUrl.startsWith('http://10.0.2.2')
  );
}

export const API_CONFIG_ERROR =
  enforceHttps && API_BASE_URL.startsWith('http://') && !isLocalHttp(API_BASE_URL)
    ? `Insecure API URL blocked: ${API_BASE_URL}. Use HTTPS or disable with EXPO_PUBLIC_ENFORCE_HTTPS=false for local testing.`
    : null;

/** Scheme + host for About / support (no path). */
export function getApiOriginLabel(): string {
  try {
    const u = new URL(API_BASE_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return API_BASE_URL;
  }
}
