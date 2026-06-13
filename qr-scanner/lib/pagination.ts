/** Laravel paginator JSON shape when embedded under `data`. */
type PaginatedEnvelope = {
  data?: unknown[];
  total?: number;
  current_page?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Normalizes API responses that use either a raw array or a Laravel paginator under `data`.
 */
export function paginatedItems<T>(payload: { data?: unknown } | null | undefined): T[] {
  const raw = payload?.data;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (isRecord(raw) && Array.isArray(raw.data)) return raw.data as T[];
  return [];
}

export function paginatedTotal(payload: { data?: unknown } | null | undefined): number {
  const raw = payload?.data;
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (isRecord(raw)) {
    const env = raw as PaginatedEnvelope;
    if (typeof env.total === 'number') return env.total;
    if (Array.isArray(env.data)) return env.data.length;
  }
  return 0;
}
