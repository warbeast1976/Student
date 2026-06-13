/**
 * Pulls a user-facing message from Laravel JSON (`message` or first `errors` entry).
 */
export function extractApiErrorMessage(payload: unknown, status: number, fallback: string): string {
  if (payload && typeof payload === 'object' && payload !== null) {
    const p = payload as Record<string, unknown>;
    const msg = p.message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg.trim();
    }
    const errs = p.errors;
    if (errs && typeof errs === 'object' && errs !== null && !Array.isArray(errs)) {
      for (const key of Object.keys(errs)) {
        const val = (errs as Record<string, unknown>)[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string' && val[0].trim()) {
          return val[0].trim();
        }
        if (typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    }
  }
  return status ? `${fallback} (${status})` : fallback;
}

export async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}
