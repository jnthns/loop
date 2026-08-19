import type { Trending, TrendingPlayer } from '~/lib/schemas/trending';

/**
 * What to write to `data/trending.json` when the trending fetch did not come
 * back clean.
 *
 * Sleeper's trending endpoint is the "who is going viral on the waiver wire"
 * read, and it is the single most rate-limited call this repo makes: it is
 * keyless, IP-limited, and the loop hits it every six hours from a shared
 * GitHub-hosted runner. Before this, a 429 there was swallowed by the sync's
 * `.catch(() => [])` and written straight through — an empty adds list stamped
 * with a fresh `capturedAt`, which reads on the site as "nobody is trending"
 * rather than "we got rate limited". A rate limit must never look like an
 * answer.
 *
 * So a failed (or suspiciously empty) list carries the previous snapshot
 * forward, with the previous `capturedAt` kept so the staleness is visible.
 */
export interface FetchedTrending {
  /** Null means the fetch failed — not "no players are trending". */
  adds: TrendingPlayer[] | null;
  drops: TrendingPlayer[] | null;
}

export interface TrendingResolution {
  trending: Trending;
  /** Lists that came from the previous snapshot instead of this run. */
  carried: ('adds' | 'drops')[];
}

/**
 * A list is carried forward when the fetch failed, and also when it came back
 * empty while the committed snapshot had rows — the same "write floor" the
 * market sync uses, for the same reason: a truncated read is worse than a stale
 * one, because it looks current.
 */
export function resolveTrending(
  fetched: FetchedTrending,
  previous: Trending,
  capturedAt: string,
  lookbackHours = 24,
): TrendingResolution {
  const carried: ('adds' | 'drops')[] = [];

  const pick = (key: 'adds' | 'drops'): TrendingPlayer[] => {
    const fresh = fetched[key];
    const prior = previous[key];
    if (fresh === null || (fresh.length === 0 && prior.length > 0)) {
      carried.push(key);
      return prior;
    }
    return fresh;
  };

  const adds = pick('adds');
  const drops = pick('drops');

  return {
    trending: {
      // Keep the old timestamp when anything is carried: the snapshot is only as
      // fresh as its stalest list.
      capturedAt: carried.length > 0 ? previous.capturedAt : capturedAt,
      lookbackHours,
      adds,
      drops,
    },
    carried,
  };
}
