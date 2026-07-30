import type { NewsItem } from '~/lib/schemas/news';

/**
 * Canonical form of a headline for syndication dedupe.
 * Same story from ESPN and Yahoo often differs only by source, not title.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DedupeByTitleOptions {
  /** When titles collide, keep the item with the later publishedAt. */
  strategy?: 'newest' | 'first';
}

/**
 * Collapse items that share the same normalized title.
 * Input order matters for `first`; for `newest`, the latest publishedAt wins.
 */
export function dedupeByTitle(
  items: NewsItem[],
  options: DedupeByTitleOptions = {},
): NewsItem[] {
  const { strategy = 'newest' } = options;
  const byTitle = new Map<string, NewsItem>();

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;

    const prior = byTitle.get(key);
    if (!prior) {
      byTitle.set(key, item);
      continue;
    }

    if (strategy === 'first') continue;

    if (item.publishedAt.localeCompare(prior.publishedAt) > 0) {
      byTitle.set(key, item);
    }
  }

  return items.filter((item) => {
    const key = normalizeTitle(item.title);
    if (!key) return true;
    return byTitle.get(key)?.id === item.id;
  });
}
