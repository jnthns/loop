import { describe, expect, it } from 'vitest';
import { facetCounts, filterNews, queryNews, sortNews } from '~/lib/news/query';
import type { NewsItem } from '~/lib/schemas/news';

function item(o: Partial<NewsItem> & Pick<NewsItem, 'id'>): NewsItem {
  return {
    title: `Story ${o.id}`,
    url: `https://example.com/${o.id}`,
    source: 'ESPN NFL',
    sourceId: 'espn-nfl',
    publishedAt: '2026-09-10T10:00:00.000Z',
    summary: '',
    tags: [],
    players: [],
    teams: [],
    ...o,
  };
}

const items: NewsItem[] = [
  item({
    id: 'a',
    title: 'Chase injury update',
    summary: 'hamstring',
    publishedAt: '2026-09-10T12:00:00.000Z',
    tags: ['injury'],
    teams: ['ATL'],
    players: ['bijan-robinson'],
  }),
  item({
    id: 'b',
    source: 'r/DynastyFF',
    sourceId: 'reddit-dynastyff',
    title: 'Trade rumor',
    publishedAt: '2026-09-09T10:00:00.000Z',
    tags: ['trade'],
  }),
  item({
    id: 'c',
    title: 'Chase injury update',
    publishedAt: '2026-09-08T10:00:00.000Z',
    tags: ['injury'],
    teams: ['CIN'],
  }),
];

describe('filterNews', () => {
  it('filters by text query across title and summary', () => {
    const out = filterNews(items, { query: 'hamstring' });
    expect(out.map((i) => i.id)).toEqual(['a']);
  });

  it('dedupes titles when requested', () => {
    const out = filterNews(items, { dedupeTitles: true });
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('narrows to watched players', () => {
    const out = filterNews(items, { mineOnly: true, watchedPlayerIds: ['bijan-robinson'] });
    expect(out.map((i) => i.id)).toEqual(['a']);
  });
});

describe('sortNews', () => {
  it('sorts oldest first', () => {
    const out = sortNews(items, 'oldest');
    expect(out.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by source then date', () => {
    const out = sortNews(items, 'source');
    expect(out[0].id).toBe('a');
    expect(out[out.length - 1].id).toBe('b');
  });

  it('sorts by title', () => {
    const out = sortNews(items, 'title');
    expect(out.map((i) => i.title)).toEqual([
      'Chase injury update',
      'Chase injury update',
      'Trade rumor',
    ]);
  });
});

describe('queryNews', () => {
  it('applies filter then sort', () => {
    const out = queryNews(items, { tag: 'injury' }, 'oldest');
    expect(out.map((i) => i.id)).toEqual(['c', 'a']);
  });
});

describe('facetCounts', () => {
  it('counts tags by frequency', () => {
    expect(facetCounts(items, 'tag')).toEqual([
      ['injury', 2],
      ['trade', 1],
    ]);
  });
});
