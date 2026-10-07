const USER_AGENT = 'ApplyForMeBot/1.0 (+job aggregation; contact: applyforme@example.com)';

const TIMEOUT_MS = 15_000;

class HttpError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  return withRetry(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        // Callers (e.g. the Apify connector) may pass a longer budget signal.
        signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      throw new HttpError(
        `Network error for ${url}: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} for ${url}`, response.status >= 500);
    }
    return response.text();
  });
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  return JSON.parse(text) as T;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof HttpError ? error.retryable : true;
      if (!retryable || attempt === attempts - 1) break;
      await delay(600);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
