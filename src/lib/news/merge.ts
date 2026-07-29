import type { NewsItem } from '~/lib/schemas/news';

export interface MergeOptions {
  /** Hard cap on retained items — the file is committed, so it cannot grow forever. */
  limit?: number;
  /** Drop anything older than this many days. */
  maxAgeDays?: number;
  now?: Date;
}

const DAY = 86_400_000;

/**
 * Fold freshly fetched items into the committed archive.
 *
 * Ids are derived from the canonical URL, so a story refetched on every cron run
 * collapses onto its existing entry rather than duplicating. Existing enrichment
 * is preserved where the new copy has less of it — a later pass may have tagged
 * an item by hand, and a refetch must not silently undo that.
 */
export function mergeNews(
  existing: NewsItem[],
  incoming: NewsItem[],
  options: MergeOptions = {},
): NewsItem[] {
  const { limit = 400, maxAgeDays = 120, now = new Date() } = options;
  const byId = new Map<string, NewsItem>();

  for (const item of existing) byId.set(item.id, item);

  for (const item of incoming) {
    const prior = byId.get(item.id);
    byId.set(item.id, prior ? reconcile(prior, item) : item);
  }

  const cutoff = now.getTime() - maxAgeDays * DAY;

  return [...byId.values()]
    .filter((item) => {
      const at = new Date(item.publishedAt).getTime();
      return Number.isNaN(at) ? true : at >= cutoff;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** Keep the richer version of each field; never lose hand-added enrichment. */
function reconcile(prior: NewsItem, next: NewsItem): NewsItem {
  return {
    ...next,
    summary: next.summary.length >= prior.summary.length ? next.summary : prior.summary,
    tags: [...new Set([...prior.tags, ...next.tags])],
    players: [...new Set([...prior.players, ...next.players])],
    teams: [...new Set([...prior.teams, ...next.teams])],
    // The first sighting is the real publication time; refetches can drift.
    publishedAt: prior.publishedAt,
  };
}
