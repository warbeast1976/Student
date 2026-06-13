import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'sars_offline_checkin_queue_v1';
const MAX_QUEUE_SIZE = 30;
const TTL_MS = 24 * 60 * 60 * 1000;
const DEDUPE_WINDOW_MS = 90 * 1000;

export type QueuedCheckin = {
  id: string;
  payload: string;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
};

function now() {
  return Date.now();
}

function normalizeQueue(items: QueuedCheckin[]): QueuedCheckin[] {
  const cutoff = now() - TTL_MS;
  return items
    .filter((item) => item && typeof item.payload === 'string' && item.payload.trim())
    .filter((item) => Number(item.createdAt) >= cutoff)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
    .slice(0, MAX_QUEUE_SIZE);
}

export async function readQueuedCheckins(): Promise<QueuedCheckin[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeQueue(parsed as QueuedCheckin[]);
  } catch {
    return [];
  }
}

async function writeQueuedCheckins(items: QueuedCheckin[]): Promise<QueuedCheckin[]> {
  const normalized = normalizeQueue(items);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function enqueueCheckin(payload: string): Promise<QueuedCheckin[]> {
  const normalizedPayload = String(payload || '').trim();
  if (!normalizedPayload) return readQueuedCheckins();
  const existing = await readQueuedCheckins();
  const ts = now();
  const dupe = existing.find(
    (item) => item.payload === normalizedPayload && ts - Number(item.createdAt) <= DEDUPE_WINDOW_MS
  );
  if (dupe) return existing;

  const next: QueuedCheckin = {
    id: `q_${ts}_${Math.random().toString(36).slice(2, 9)}`,
    payload: normalizedPayload,
    createdAt: ts,
    updatedAt: ts,
    attempts: 0,
  };
  const merged = [...existing, next];
  return writeQueuedCheckins(merged);
}

export async function removeQueuedCheckin(id: string): Promise<QueuedCheckin[]> {
  const existing = await readQueuedCheckins();
  const next = existing.filter((item) => item.id !== id);
  return writeQueuedCheckins(next);
}

export async function updateQueuedCheckin(
  id: string,
  patch: Partial<Pick<QueuedCheckin, 'attempts' | 'lastError' | 'updatedAt'>>
): Promise<QueuedCheckin[]> {
  const existing = await readQueuedCheckins();
  const next = existing.map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          updatedAt: patch.updatedAt ?? now(),
        }
      : item
  );
  return writeQueuedCheckins(next);
}

export async function clearQueuedCheckins(): Promise<QueuedCheckin[]> {
  await AsyncStorage.removeItem(QUEUE_KEY);
  return [];
}

export async function clearTerminalFailedCheckins(): Promise<QueuedCheckin[]> {
  const existing = await readQueuedCheckins();
  const next = existing.filter((item) => {
    const msg = String(item.lastError || '').toLowerCase();
    const terminal =
      msg.includes('invalid') ||
      msg.includes('expired') ||
      msg.includes('closed') ||
      msg.includes('not found') ||
      msg.includes('already');
    return !terminal;
  });
  return writeQueuedCheckins(next);
}
