import { dedupeByPlayer, dedupeByTitle } from '~/lib/news/dedupe';
import type { NewsItem } from '~/lib/schemas/news';

export type NewsSort = 'newest' | 'oldest' | 'source' | 'title';

export interface NewsFilter {
  source?: string;
  tag?: string;
  team?: string;
  /** Case-insensitive substring match on title and summary. */
  query?: string;
  mineOnly?: boolean;
  watchedPlayerIds?: string[];
  /** Collapse syndicated headlines before filtering. */
  dedupeTitles?: boolean;
  /**
   * Keep at most one item per player before filtering — the feed's default.
   * Subsumes `dedupeTitles` for the items it looks at, so setting both is
   * harmless rather than contradictory.
   */
  uniquePerPlayer?: boolean;
}

export function facetCounts(
  items: NewsItem[],
  field: 'source' | 'tag' | 'team',
): [string, number][] {
  const values =
    field === 'source'
      ? items.map((i) => i.source)
      : items.flatMap((i) => (field === 'tag' ? i.tags : i.teams));
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function filterNews(items: NewsItem[], filter: NewsFilter = {}): NewsItem[] {
  const watched = new Set(filter.watchedPlayerIds ?? []);
  const needle = filter.query?.trim().toLowerCase() ?? '';

  // Dedupe runs before the facet filters so the counts and the list agree: a
  // story collapsed away must not still be counted under its source.
  let out = items;
  if (filter.uniquePerPlayer) out = dedupeByPlayer(out);
  else if (filter.dedupeTitles) out = dedupeByTitle(out);

  if (filter.source) out = out.filter((i) => i.source === filter.source);
  if (filter.tag) out = out.filter((i) => i.tags.includes(filter.tag!));
  if (filter.team) out = out.filter((i) => i.teams.includes(filter.team!));
  if (filter.mineOnly) out = out.filter((i) => i.players.some((p) => watched.has(p)));
  if (needle) {
    out = out.filter((i) => {
      const haystack = `${i.title} ${i.summary}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  return out;
}

export function sortNews(items: NewsItem[], sort: NewsSort = 'newest'): NewsItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    case 'source':
      return sorted.sort(
        (a, b) => a.source.localeCompare(b.source) || b.publishedAt.localeCompare(a.publishedAt),
      );
    case 'title':
      return sorted.sort(
        (a, b) => a.title.localeCompare(b.title) || b.publishedAt.localeCompare(a.publishedAt),
      );
    case 'newest':
    default:
      return sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
}

export function queryNews(
  items: NewsItem[],
  filter: NewsFilter = {},
  sort: NewsSort = 'newest',
): NewsItem[] {
  return sortNews(filterNews(items, filter), sort);
}
