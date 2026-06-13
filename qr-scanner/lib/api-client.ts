import { API_BASE_URL, API_CONFIG_ERROR, API_KEY } from '@/constants/api';
import { extractApiErrorMessage, parseJsonResponse } from '@/lib/api-errors';
import { emitUnauthorized } from '@/lib/auth-events';

type ApiFetchOptions = RequestInit & {
  token?: string | null;
  timeoutMs?: number;
};

export class ApiHttpError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.payload = payload;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

/** JSON request headers including optional `X-API-Key` (matches backend `FRONTEND_API_KEY`). */
export function buildJsonHeaders(token?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  if (API_CONFIG_ERROR) {
    throw new Error(API_CONFIG_ERROR);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (requestError) {
    if (requestError instanceof Error && requestError.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw requestError;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}) {
  const { token, headers, timeoutMs, ...rest } = options;
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...buildJsonHeaders(token),
      ...(headers ?? {}),
    },
  }, timeoutMs);

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    if (response.status === 401) emitUnauthorized('session-expired');
    throw new ApiHttpError(extractApiErrorMessage(payload, response.status, 'Request failed'), response.status, payload);
  }

  return payload as T;
}

/** POST JSON and parse Laravel errors consistently (used outside TanStack helpers). */
export async function postJson<T = unknown>(
  path: string,
  body: unknown,
  token?: string | null,
  timeoutMs?: number
): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: buildJsonHeaders(token),
    body: JSON.stringify(body),
  }, timeoutMs);
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    if (response.status === 401) emitUnauthorized('session-expired');
    throw new ApiHttpError(extractApiErrorMessage(payload, response.status, 'Request failed'), response.status, payload);
  }
  return payload as T;
}
