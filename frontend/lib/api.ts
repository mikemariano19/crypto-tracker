const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const REQUEST_TIMEOUT_MS = 10_000;

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  stale?: boolean;
  cached_at?: string;
  error?: string;
  retryAfter?: number;
};

/** A failed API call, with what callers need to react to it differently. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Seconds until a rate-limited request can be tried again. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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
  return request<T>(url, {}, REQUEST_TIMEOUT_MS);
}

/**
 * For the few requests that start work on the server. These can take a while:
 * a free Render instance sleeps when idle and needs up to a minute to wake.
 */
export async function postApi<T>(url: string, timeoutMs: number, body?: unknown): Promise<T> {
  const init: RequestInit = body === undefined
    ? { method: 'POST' }
    : { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };

  return (await request<T>(url, init, timeoutMs)).data;
}

async function request<T>(url: string, init: RequestInit, timeoutMs: number): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });

  let json: ApiEnvelope<T>;

  try {
    json = await res.json();
  } catch {
    throw new ApiError(`Unexpected response from API (${res.status})`, res.status);
  }

  if (!res.ok || !json.success || json.data === undefined) {
    throw new ApiError(json.error ?? `API request failed (${res.status})`, res.status, json.retryAfter ?? null);
  }

  return { data: json.data, stale: json.stale ?? false, cachedAt: json.cached_at ?? null };
}
