type UnauthorizedHandler = (reason: string) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let lastUnauthorizedAt = 0;
const UNAUTHORIZED_THROTTLE_MS = 1500;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function emitUnauthorized(reason = 'unauthorized') {
  const now = Date.now();
  if (now - lastUnauthorizedAt < UNAUTHORIZED_THROTTLE_MS) return;
  lastUnauthorizedAt = now;
  unauthorizedHandler?.(reason);
}
