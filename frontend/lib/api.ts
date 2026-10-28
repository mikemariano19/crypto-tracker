const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const REQUEST_TIMEOUT_MS = 10_000;

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  stale?: boolean;
  cached_at?: string;
  error?: string;
};

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

/**
 * SWR fetcher for the Laravel API. Unwraps `{ success, data }` and throws on
 * any failure, so SWR keeps showing the last good data instead of clearing it.
 */
export async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let json: ApiEnvelope<T>;

  try {
    json = await res.json();
  } catch {
    throw new Error(`Unexpected response from API (${res.status})`);
  }

  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.error ?? `API request failed (${res.status})`);
  }

  return json.data;
}
