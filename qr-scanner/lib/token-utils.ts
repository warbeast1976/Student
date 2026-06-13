function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  if (typeof atob !== 'function') {
    throw new Error('Base64 decoder unavailable in this runtime.');
  }
  return atob(padded);
}

export function getJwtExpMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadRaw = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadRaw) as { exp?: unknown };
    const expSeconds = Number(payload.exp);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null;
    return expSeconds * 1000;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null | undefined, skewMs = 5000): boolean {
  const expMs = getJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() + Math.max(0, skewMs) >= expMs;
}
