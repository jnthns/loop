/**
 * One place to survive HTTP 429.
 *
 * Every upstream this repo reads (Sleeper, ESPN, RSS hosts) is free and keyless,
 * which is exactly why they rate-limit by IP. A single 429 used to end the call:
 * the Sleeper client threw, and callers that treat a source as a nice-to-have
 * swallowed it and carried on with nothing — a rate limit reading as "no data".
 *
 * So: retry the statuses that mean "later, not never" (429 and 5xx), honour
 * `Retry-After` when the server sends one, and back off exponentially otherwise.
 * Anything else — 404, 400 — returns immediately, because retrying a real answer
 * is just a slower way to get the same answer.
 */

export interface RetryOptions {
  /** Attempts after the first. Default 3, so 4 requests worst case. */
  retries?: number;
  /** First backoff, doubled per attempt. Default 1s. */
  baseDelayMs?: number;
  /** Ceiling on any single wait, including a server's `Retry-After`. Default 30s. */
  maxDelayMs?: number;
  /** Injected for tests; defaults to real `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Called before each wait — the caller decides how loudly to log. */
  onRetry?: (info: { attempt: number; status: number; delayMs: number; url: string }) => void;
}

const RETRYABLE = (status: number) => status === 429 || status === 408 || status >= 500;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `Retry-After` is either delay-seconds or an HTTP date. Returns null when the
 * header is absent or unparseable, which means "use our own backoff".
 */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - now);
}

/** Backoff for one attempt: the server's ask if it made one, else exponential. */
export function backoffMs(
  attempt: number,
  retryAfter: string | null,
  { baseDelayMs = 1000, maxDelayMs = 30_000 }: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'> = {},
): number {
  const asked = parseRetryAfter(retryAfter);
  const ours = baseDelayMs * 2 ** attempt;
  return Math.min(asked ?? ours, maxDelayMs);
}

/**
 * `fetch`, plus retries on 429/408/5xx. Resolves with the last response when the
 * retries run out — the caller still owns what a non-ok response means.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    fetchImpl = fetch,
    sleep = defaultSleep,
    onRetry,
  } = options;

  let last: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetchImpl(url, init);
    if (res.ok || !RETRYABLE(res.status)) return res;
    last = res;
    if (attempt === retries) break;

    const delayMs = backoffMs(attempt, res.headers?.get?.('retry-after') ?? null, {
      baseDelayMs,
      maxDelayMs,
    });
    onRetry?.({ attempt: attempt + 1, status: res.status, delayMs, url });
    await sleep(delayMs);
  }
  return last as Response;
}
