import { describe, expect, it, vi } from 'vitest';
import { backoffMs, fetchWithRetry, parseRetryAfter } from '~/lib/net/retry';
import { resolveTrending } from '~/lib/sleeper/trending';
import type { Trending, TrendingPlayer } from '~/lib/schemas/trending';

/** Minimal Response stand-in — only what the retry helper reads. */
function res(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

const player = (name: string, count: number): TrendingPlayer => ({
  playerId: name.toLowerCase().replace(/\s+/g, '-'),
  sleeperId: `${count}`,
  name,
  pos: 'WR',
  nflTeam: 'CIN',
  count,
});

const previous: Trending = {
  capturedAt: '2026-08-19T18:52:12.480Z',
  lookbackHours: 24,
  adds: [player('Najee Harris', 93230)],
  drops: [player('Keenan Allen', 4001)],
};

describe('parseRetryAfter', () => {
  it('reads delay-seconds', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
  });

  it('reads an HTTP date, relative to now', () => {
    const now = Date.parse('2026-08-19T12:00:00.000Z');
    expect(parseRetryAfter('Wed, 19 Aug 2026 12:00:45 GMT', now)).toBe(45_000);
  });

  it('never returns a negative wait for a date in the past', () => {
    const now = Date.parse('2026-08-19T12:00:00.000Z');
    expect(parseRetryAfter('Wed, 19 Aug 2026 11:59:00 GMT', now)).toBe(0);
  });

  it('returns null for a missing or unparseable header', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

describe('backoffMs', () => {
  it('doubles per attempt when the server says nothing', () => {
    expect(backoffMs(0, null, { baseDelayMs: 1000 })).toBe(1000);
    expect(backoffMs(1, null, { baseDelayMs: 1000 })).toBe(2000);
    expect(backoffMs(2, null, { baseDelayMs: 1000 })).toBe(4000);
  });

  it('prefers the server ask over our own backoff', () => {
    expect(backoffMs(0, '12', { baseDelayMs: 1000 })).toBe(12_000);
  });

  it('caps even a server ask', () => {
    expect(backoffMs(0, '3600', { maxDelayMs: 30_000 })).toBe(30_000);
  });
});

describe('fetchWithRetry', () => {
  it('retries a 429 and returns the eventual success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(res(200));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const out = await fetchWithRetry('https://api.sleeper.app/v1/x', {}, { fetchImpl, sleep });

    expect(out.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('gives up after the configured retries and hands back the 429', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(429));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const out = await fetchWithRetry(
      'https://api.sleeper.app/v1/x',
      {},
      { fetchImpl, sleep, retries: 2, baseDelayMs: 10 },
    );

    expect(out.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry a real answer like 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404));
    const out = await fetchWithRetry('https://api.sleeper.app/v1/x', {}, { fetchImpl });
    expect(out.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a 500 too', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const out = await fetchWithRetry('https://api.sleeper.app/v1/x', {}, { fetchImpl, sleep });
    expect(out.ok).toBe(true);
  });
});

describe('resolveTrending', () => {
  const now = '2026-08-20T00:00:00.000Z';

  it('uses the fresh lists when both came back', () => {
    const fresh = [player('Barion Brown', 62469)];
    const freshDrops = [player('Tyler Boyd', 900)];
    const { trending, carried } = resolveTrending({ adds: fresh, drops: freshDrops }, previous, now);
    expect(carried).toEqual([]);
    expect(trending.adds).toEqual(fresh);
    expect(trending.capturedAt).toBe(now);
  });

  it('carries the previous adds forward when the fetch failed — never blanks them', () => {
    const freshDrops = [player('Tyler Boyd', 900)];
    const { trending, carried } = resolveTrending({ adds: null, drops: freshDrops }, previous, now);
    expect(carried).toEqual(['adds']);
    expect(trending.drops).toEqual(freshDrops);
    expect(trending.adds).toEqual(previous.adds);
    // Stale data must not claim to be fresh.
    expect(trending.capturedAt).toBe(previous.capturedAt);
  });

  it('treats an empty list against a non-empty snapshot as a failed read', () => {
    const { trending, carried } = resolveTrending({ adds: [], drops: [] }, previous, now);
    expect(carried).toEqual(['adds', 'drops']);
    expect(trending.adds).toEqual(previous.adds);
    expect(trending.drops).toEqual(previous.drops);
  });

  it('accepts an empty list when there was nothing to lose', () => {
    const empty: Trending = { ...previous, adds: [], drops: [] };
    const { trending, carried } = resolveTrending({ adds: [], drops: [] }, empty, now);
    expect(carried).toEqual([]);
    expect(trending.capturedAt).toBe(now);
  });
});
