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
  return (await fetchApiWithMeta<T>(url)).data;
}

export type ApiResult<T> = {
  data: T;
  /** The API served its last good copy because upstream was unavailable. */
  stale: boolean;
  /** When the API got this data from upstream (ISO), if it says. */
  cachedAt: string | null;
};

/**
 * fetchApi, plus the envelope's freshness info for screens that show it.
 */
export async function fetchApiWithMeta<T>(url: string): Promise<ApiResult<T>> {
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

  return { data: json.data, stale: json.stale ?? false, cachedAt: json.cached_at ?? null };
}
