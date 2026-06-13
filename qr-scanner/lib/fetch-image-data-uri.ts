import { buildJsonHeaders } from '@/lib/api-client';

/** Loads an authenticated PNG (or other binary) URL as a `data:` URI for `<Image />`. */
export async function fetchAuthenticatedPngDataUri(
  url: string,
  token: string | null | undefined
): Promise<string> {
  const response = await fetch(url, { headers: buildJsonHeaders(token) });
  if (!response.ok) {
    const text = await response.text();
    let message = 'Unable to load image.';
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j?.message) message = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const buf = await response.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  return `data:image/png;base64,${base64}`;
}
