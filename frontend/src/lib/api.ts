export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    // Get a fresh masked token each time, including after login rotates the CSRF secret.
    const { csrf_token } = await api<{ csrf_token: string }>('auth/csrf/', undefined, signal);
    headers['X-CSRFToken'] = csrf_token;
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch {
    if (signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    throw new ApiError(0, 'network_error', 'Unable to reach Inventory Manager. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null) as { code?: string; message?: string } | null;
  if (!response.ok) {
    if (response.status === 401 && path !== 'auth/me/') window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      response.status,
      data?.code ?? 'request_failed',
      data?.message ?? 'Inventory Manager is unavailable right now. Please try again.',
    );
  }
  if (data === null) throw new ApiError(502, 'invalid_response', 'Inventory Manager returned an unexpected response. Please try again.');
  return data as T;
}
